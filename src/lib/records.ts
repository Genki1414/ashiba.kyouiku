import type { SupabaseClient } from "@supabase/supabase-js";
import { COURSES } from "@/content/courses";

/* 事業者ひとつぶんの受講記録（辞めた人もふくむ）。

   特別教育の記録は3年保存する決まり。
   毎日の名簿からは抜けた人を外したので、
   「誰にいつ受けさせたか」を後から示すのは、この形で出す。

   同じものを2か所から使う。
   ・本部（/api/owner/ledger）… どの事業者ぶんでも
   ・その会社の教育担当者（/api/admin/past）… 自分の事業者ぶんだけ
   ここを1つにしておかないと、片方に足した項目がもう片方から抜ける。

   ログインのクッキーを読む所とは分けてある。
   分けておくと、本物のスキーマに当てて確かめられる（tests/admin-db.mts）。 */

export type Record1 = {
  id: string;
  course: string;
  seatCode: string;
  lessonsPassed: number;
  watchedSec: number;
  exam: { score: number; total: number; passed: boolean } | null;
  cert: { no: string; at: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  /** 取り消した受講。消さずに閉じてある */
  closedAt: string | null;
  createdAt: string | null;
};

export type PersonState = "在籍" | "申し込み中" | "退職" | "つながっていない";

export type Person = {
  userId: string;
  name: string;
  email: string;
  state: PersonState;
  requestedAt: string | null;
  approvedAt: string | null;
  leftAt: string | null;
  records: Record1[];
};

export type Records = {
  people: Person[];
  totals: { people: number; active: number; gone: number; certs: number };
};

type Row = Record<string, unknown>;

const rank = (s: PersonState) =>
  s === "在籍" ? 0 : s === "申し込み中" ? 1 : s === "退職" ? 2 : 3;

export async function companyRecords(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Records> {
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
  const memberships = (mems ?? []) as Row[];
  const enrolls = (ens ?? []) as Row[];

  const ids = [...new Set([
    ...memberships.map((m) => m.user_id as string),
    ...enrolls.map((e) => e.user_id as string),
  ])];
  const eids = enrolls.map((e) => e.id as string);
  const grab = async (table: string, cols: string) => {
    if (!eids.length) return [] as Row[];
    const { data } = await supabase.from(table).select(cols).in("enrollment_id", eids);
    return (data ?? []) as unknown as Row[];
  };
  /* どの受講コードで受けたかは、後から問われる */
  const seatIds = [...new Set(
    enrolls.map((e) => e.seat_id as string | null).filter(Boolean),
  )] as string[];

  /* ここから先はどれも、上で引いたものから決まる。まとめて聞く。
     順に待つと、事業者を1つ開くだけで5往復する */
  const [{ data: us }, progress, exams, certs, { data: seats }] = await Promise.all([
    ids.length
      ? supabase.from("users").select("id, name, email").in("id", ids)
      : Promise.resolve({ data: [] as Row[] }),
    grab("progress", "enrollment_id, lesson_id, watched_sec, quiz_passed_at"),
    grab("exams", "enrollment_id, score, total, passed, created_at"),
    grab("certificates", "enrollment_id, cert_no, issued_at, revoked_at"),
    seatIds.length
      ? supabase.from("seats").select("id, code").in("id", seatIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);
  const users = (us ?? []) as Row[];
  const codeOf = new Map((seats ?? []).map((s) => [s.id as string, (s.code as string) ?? ""]));

  const uName = new Map(users.map((u) => [u.id as string, (u.name as string) ?? ""]));
  const uMail = new Map(users.map((u) => [u.id as string, (u.email as string) ?? ""]));
  const courseName = new Map(COURSES.map((c) => [c.id, c.short]));

  /* 1人が申し込み直していると、同じ会社の紐付けが何本か残る。
     開いているものを先に、無ければいちばん新しいものを見る */
  const memOf = new Map<string, Row>();
  for (const m of memberships) {
    const k = m.user_id as string;
    const cur = memOf.get(k);
    if (!cur || (!m.left_at && cur.left_at) || `${m.requested_at}` > `${cur.requested_at}`) {
      memOf.set(k, m);
    }
  }

  const people: Person[] = ids.map((id) => {
    const m = memOf.get(id);
    const state: PersonState = !m
      ? "つながっていない"
      : m.left_at
        ? "退職"
        : m.approved_at
          ? "在籍"
          : "申し込み中";

    const records = enrolls
      .filter((e) => e.user_id === id)
      .map((e): Record1 => {
        const eid = e.id as string;
        const prog = progress.filter((p) => p.enrollment_id === eid);
        const exam =
          exams
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
          closedAt: (e.closed_at as string) ?? null,
          createdAt: (e.created_at as string) ?? null,
        };
      })
      /* 新しい受講が上。取り消したものは下 */
      .sort((a, b) => `${b.createdAt}`.localeCompare(`${a.createdAt}`));

    return {
      userId: id,
      name: uName.get(id) ?? "",
      email: uMail.get(id) ?? "",
      state,
      requestedAt: (m?.requested_at as string) ?? null,
      approvedAt: (m?.approved_at as string) ?? null,
      leftAt: (m?.left_at as string) ?? null,
      records,
    };
  });

  people.sort((a, b) => rank(a.state) - rank(b.state) || a.name.localeCompare(b.name, "ja"));

  return {
    people,
    totals: {
      people: people.length,
      active: people.filter((p) => p.state === "在籍").length,
      gone: people.filter((p) => p.state === "退職").length,
      certs: people.reduce((n, p) => n + p.records.filter((r) => r.cert).length, 0),
    },
  };
}
