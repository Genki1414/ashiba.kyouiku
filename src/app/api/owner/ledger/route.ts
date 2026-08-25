import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { COURSES } from "@/content/courses";

/* 本部（この仕組みを売っている側）の元帳。

   なぜ要るか。
   特別教育を「行った事業者」は、受講の記録を3年保存する決まりがある。
   その教育を行っているのはこの仕組みなので、記録はこちら側に残る。
   受講した人が会社を辞めても、会社が使うのをやめても、消えない。

   教育担当者の名簿からは、抜けた人を外した（毎日の名簿の邪魔になる）。
   外に出さなくなったぶん、**ここには全部出す**。
   ここが無いと、辞めた人の分を後から示せる場所がどこにも無くなる。

   誰が本部かは環境変数 OWNER_EMAILS で決める（src/lib/owner.ts）。
   データベースに持たせない。担当者の画面から昇格する道を作らないため。

   companyId を付けると、その事業者ぶんの中身を返す。
   付けなければ、事業者の一覧と全体の数字。 */

type Row = Record<string, unknown>;

const nameOf = (rows: Row[] | null, key = "id", val = "name") =>
  new Map((rows ?? []).map((r) => [r[key] as string, (r[val] as string) ?? ""]));

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけが見られる画面です。" }, { status: 403 });
  }

  const only = req.nextUrl.searchParams.get("companyId");
  return only ? await one(supabase, only) : await all(supabase);
}

/* ── 事業者の一覧と、全体の数字 ── */
async function all(supabase: NonNullable<ReturnType<typeof getServiceClient>>) {
  /* 注文の無い事業者も出す。前は注文から会社を引いていたので、
     まだ買っていない事業者を無償利用に立てられなかった */
  const { data: cos } = await supabase
    .from("companies")
    .select("id, name, trial, join_code, created_at")
    .order("created_at");
  const companies = cos ?? [];

  const [{ data: mems }, { data: ens }, { data: ords }] = await Promise.all([
    supabase.from("memberships").select("company_id, approved_at, left_at"),
    supabase.from("enrollments").select("id, company_id, user_id"),
    supabase.from("orders").select("company_id, amount, status"),
  ]);

  /* 修了証は受講にぶら下がっている。会社ごとに数えるため、受講から引く */
  const enrolls = ens ?? [];
  const byEnroll = new Map(enrolls.map((e) => [e.id as string, e.company_id as string | null]));
  const { data: certs } = await supabase
    .from("certificates")
    .select("enrollment_id, issued_at, revoked_at");

  const zero = () => ({ active: 0, waiting: 0, gone: 0, learners: 0, certs: 0, sales: 0, orders: 0 });
  const acc = new Map<string, ReturnType<typeof zero>>();
  const get = (id: string | null) => {
    if (!id) return null;
    if (!acc.has(id)) acc.set(id, zero());
    return acc.get(id)!;
  };

  for (const m of mems ?? []) {
    const a = get(m.company_id as string);
    if (!a) continue;
    if (m.left_at) a.gone++;
    else if (m.approved_at) a.active++;
    else a.waiting++;
  }
  /* 受講した人の数。1人が2講座を受けても1人として数える */
  const seen = new Map<string, Set<string>>();
  for (const e of enrolls) {
    const cid = e.company_id as string | null;
    if (!cid) continue;
    if (!seen.has(cid)) seen.set(cid, new Set());
    seen.get(cid)!.add(e.user_id as string);
  }
  for (const [cid, set] of seen) {
    const a = get(cid);
    if (a) a.learners = set.size;
  }
  for (const c of certs ?? []) {
    if (c.revoked_at) continue;
    const a = get(byEnroll.get(c.enrollment_id as string) ?? null);
    if (a) a.certs++;
  }
  for (const o of ords ?? []) {
    const a = get(o.company_id as string);
    if (!a) continue;
    a.orders++;
    if (o.status === "paid") a.sales += (o.amount as number) ?? 0;
  }

  const rows = companies.map((c) => ({
    id: c.id as string,
    name: (c.name as string) ?? "",
    trial: c.trial === true,
    joinCode: (c.join_code as string) ?? "",
    createdAt: c.created_at as string,
    ...(acc.get(c.id as string) ?? zero()),
  }));

  return NextResponse.json({
    ok: true,
    companies: rows,
    totals: {
      companies: rows.length,
      trial: rows.filter((r) => r.trial).length,
      learners: rows.reduce((n, r) => n + r.learners, 0),
      certs: rows.reduce((n, r) => n + r.certs, 0),
      sales: rows.reduce((n, r) => n + r.sales, 0),
    },
  });
}

/* ── 事業者ひとつぶんの記録（辞めた人もふくむ）── */
async function one(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  companyId: string,
) {
  const { data: co } = await supabase
    .from("companies")
    .select("id, name, trial, join_code, created_at")
    .eq("id", companyId)
    .maybeSingle();
  if (!co) {
    return NextResponse.json({ ok: false, reason: "その事業者がありません。" }, { status: 404 });
  }

  /* この会社に関わった人は2通り。
     ① 紐付いた（いまも、過去も）
     ② この会社の席で受けた
     どちらか一方だけで引くと、抜け落ちる人が出る */
  const [{ data: mems }, { data: ens }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, requested_at, approved_at, left_at")
      .eq("company_id", companyId),
    supabase
      .from("enrollments")
      .select("id, user_id, course_id, seat_id, started_at, completed_at, closed_at, created_at")
      .eq("company_id", companyId),
  ]);
  const memberships = mems ?? [];
  const enrolls = ens ?? [];

  const ids = [...new Set([
    ...memberships.map((m) => m.user_id as string),
    ...enrolls.map((e) => e.user_id as string),
  ])];
  const { data: us } = ids.length
    ? await supabase.from("users").select("id, name, email").in("id", ids)
    : { data: [] as Row[] };
  const users = us ?? [];

  const eids = enrolls.map((e) => e.id as string);
  const grab = async (table: string, cols: string) => {
    if (!eids.length) return [] as Row[];
    const { data } = await supabase.from(table).select(cols).in("enrollment_id", eids);
    return (data ?? []) as unknown as Row[];
  };
  const [progress, exams, certs] = await Promise.all([
    grab("progress", "enrollment_id, lesson_id, watched_sec, quiz_passed_at"),
    grab("exams", "enrollment_id, score, total, passed, created_at"),
    grab("certificates", "enrollment_id, cert_no, issued_at, revoked_at"),
  ]);

  /* 受けた席の受講コード。どのコードで受けたかは、後から問われる */
  const seatIds = [...new Set(enrolls.map((e) => e.seat_id as string | null).filter(Boolean))] as string[];
  const { data: seats } = seatIds.length
    ? await supabase.from("seats").select("id, code").in("id", seatIds)
    : { data: [] as Row[] };
  const codeOf = nameOf(seats as Row[], "id", "code");

  const uName = nameOf(users as Row[]);
  const uMail = nameOf(users as Row[], "id", "email");
  const courseName = new Map(COURSES.map((c) => [c.id, c.short]));

  /* 人ごとに、紐付きの状態と、受けたものを並べる */
  const memOf = new Map<string, Row>();
  for (const m of memberships) {
    const k = m.user_id as string;
    const cur = memOf.get(k);
    /* 開いているものを優先。無ければいちばん新しいもの */
    if (!cur || (!m.left_at && cur.left_at) || `${m.requested_at}` > `${cur.requested_at}`) {
      memOf.set(k, m as Row);
    }
  }

  const people = ids.map((id) => {
    const m = memOf.get(id);
    const state = !m
      ? "つながっていない"
      : m.left_at
        ? "退職"
        : m.approved_at
          ? "在籍"
          : "申し込み中";

    const mine = enrolls.filter((e) => e.user_id === id).map((e) => {
      const eid = e.id as string;
      const prog = progress.filter((p) => p.enrollment_id === eid);
      const exam = exams
        .filter((x) => x.enrollment_id === eid)
        .sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`))[0] ?? null;
      const cert = certs.filter((c) => c.enrollment_id === eid && !c.revoked_at)[0] ?? null;
      return {
        id: eid,
        course: courseName.get(e.course_id as string) ?? (e.course_id as string) ?? "",
        seatCode: codeOf.get((e.seat_id as string) ?? "") ?? "",
        lessonsPassed: prog.filter((p) => !!p.quiz_passed_at).length,
        watchedSec: prog.reduce((n, p) => n + ((p.watched_sec as number) ?? 0), 0),
        exam: exam
          ? { score: exam.score as number, total: exam.total as number, passed: exam.passed === true }
          : null,
        cert: cert ? { no: cert.cert_no as string, at: cert.issued_at as string } : null,
        startedAt: (e.started_at as string) ?? null,
        completedAt: (e.completed_at as string) ?? null,
        /* 取り消した受講。消さずに閉じてある */
        closedAt: (e.closed_at as string) ?? null,
        createdAt: (e.created_at as string) ?? null,
      };
    });

    return {
      userId: id,
      name: uName.get(id) ?? "",
      email: uMail.get(id) ?? "",
      state,
      requestedAt: (m?.requested_at as string) ?? null,
      approvedAt: (m?.approved_at as string) ?? null,
      leftAt: (m?.left_at as string) ?? null,
      records: mine,
    };
  });

  /* 在籍 → 申し込み中 → 退職 の順。同じ状態なら名前順 */
  const rank = (s: string) => (s === "在籍" ? 0 : s === "申し込み中" ? 1 : s === "退職" ? 2 : 3);
  people.sort((a, b) => rank(a.state) - rank(b.state) || a.name.localeCompare(b.name, "ja"));

  return NextResponse.json({
    ok: true,
    company: {
      id: co.id as string,
      name: (co.name as string) ?? "",
      trial: co.trial === true,
      joinCode: (co.join_code as string) ?? "",
      createdAt: co.created_at as string,
    },
    people,
    totals: {
      people: people.length,
      active: people.filter((p) => p.state === "在籍").length,
      gone: people.filter((p) => p.state === "退職").length,
      certs: people.reduce((n, p) => n + p.records.filter((r) => r.cert).length, 0),
    },
  });
}
