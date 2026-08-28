import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { companyRecords } from "@/lib/records";
import { currentUser } from "@/lib/supabase/session";

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

  const [{ data: mems }, { data: ens }, { data: ords }, { count: users }] = await Promise.all([
    supabase.from("memberships").select("company_id, approved_at, left_at"),
    supabase.from("enrollments").select("id, company_id, user_id"),
    supabase.from("orders").select("company_id, amount, status"),
    /* 登録した人の数。事業者と紐付いていない人もふくむ（登録しただけの人） */
    supabase.from("users").select("id", { count: "exact", head: true }),
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

  /* 在籍している人。1人1社なので、事業者ごとの在籍を足せばよい */
  const linked = rows.reduce((n, r) => n + r.active, 0);

  return NextResponse.json({
    ok: true,
    companies: rows,
    totals: {
      /* 登録した事業者の数と、登録した人の数。
         「いくつ・何人まで来たか」が、まずここで分かるようにする */
      companies: rows.length,
      users: users ?? 0,
      /* 登録はしたが、まだどこの事業者にも入っていない人 */
      loose: Math.max(0, (users ?? 0) - linked),
      linked,
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

  /* 中身の組み立ては、その会社の担当者が見るものと同じ（src/lib/records.ts）。
     2か所に書くと、片方に足した項目がもう片方から抜ける */
  const { people, totals } = await companyRecords(supabase, companyId);

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
    totals,
  });
}


/* ── 教育担当者を立て直す（本部だけ）────────────────

   なぜ要るか。
   担当者を立てられるのは、その会社の担当者だけにしてある
   （/api/admin/role）。よその会社の名簿を勝手に見られては困るから。
   ところがその作りだと、**担当者が1人も居なくなった会社は詰む**。

     ・唯一の担当者が辞めた
     ・唯一の担当者が別の会社へ移った（0021 で担当を降りる）
     ・唯一の担当者が、うっかり自分を降ろした

   こうなると、名簿も修了証も誰も触れない。
   前はデータベースを直接いじるしかなかった。売り物でそれは通らない。

   ここは本部（OWNER_EMAILS）だけが押せる。
   本部が誰かは環境変数で決めていて、画面からは変えられないので、
   「担当者の画面から自分を本部に上げる」道はできない。

   自分で自分を担当者に立てるのも通す。
   本部＝この仕組みを売っている側なので、これで増える権限は無い。 */

type RoleBody = { companyId?: string; userId?: string; admin?: boolean };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ ok: false, reason: "本部だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as RoleBody;
  const companyId = (b.companyId ?? "").trim();
  const userId = (b.userId ?? "").trim();
  const want = b.admin === true;
  if (!companyId || !userId) {
    return NextResponse.json({ ok: false, reason: "会社と人が分かりません。" }, { status: 400 });
  }

  const { data: co } = await supabase
    .from("companies").select("id, name").eq("id", companyId).maybeSingle();
  if (!co) {
    return NextResponse.json({ ok: false, reason: "その事業者がありません。" }, { status: 404 });
  }

  /* その会社に在籍している人だけ。抜けた人を担当者に立てると、
     辞めた人がその会社の名簿を見続けることになる */
  const { data: mem } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .not("approved_at", "is", null)
    .is("left_at", null)
    .maybeSingle();
  if (!mem) {
    return NextResponse.json(
      { ok: false, reason: "その人は、この事業者に在籍していません。" },
      { status: 409 },
    );
  }

  /* 担当者に立てるときは、所属もこの会社に揃える。
     users.company_id が別の会社を指したままだと、
     画面はよその会社の名簿を出してしまう */
  const patch = want
    ? { role: "admin", company_id: companyId }
    : { role: "learner" };
  const { error } = await supabase.from("users").update(patch).eq("id", userId);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });

  const me = await currentUser();
  return NextResponse.json({
    ok: true,
    /* 自分を立て直したときは、画面を開き直してもらう */
    self: me?.id === userId,
    company: co.name as string,
  });
}
