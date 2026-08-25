/* 教育担当者の画面が使う問い合わせを、実際のスキーマに当てて確かめる。

   本物の Supabase の代わりに、ローカルの PostgreSQL ＋ PostgREST 互換 shim を使う。
   ここで見るのは「表と列と絞り込みが噛み合っているか」。
   RLS そのものではない（shim は service_role として動く）。

   手順:
     su postgres -c "…initdb / pg_ctl start（55432）"
     psql -d appdb -f supabase/tests/00-supabase-shim.sql -f supabase/apply-all.sql
     node tests/postgrest-shim.mjs 54321 postgres://postgres@127.0.0.1:55432/appdb
     npx tsx tests/admin-db.ts */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { buildRoster, rosterTotals } from "@/training/roster";
import { listSeats } from "@/lib/seats";
import { learnFor } from "@/lib/entitleQuery";

const URL = process.env.SHIM_URL ?? "http://127.0.0.1:54321";
const PG_URL = process.env.PG_URL ?? "postgres://postgres@127.0.0.1:55432/appdb";
const db = createClient(URL, "test-service-role-key", { auth: { persistSession: false } });

/* public.users は auth.users を参照するので、先にログインの行を作っておく
   （本番では登録のときに Supabase Auth が作り、0004 のトリガが public.users を作る） */
const raw = new pg.Client({ connectionString: PG_URL });
await raw.connect();
/* 種まきと片付けはサーバ側の立場で行う（0003 の守りに引っかからないように） */
await raw.query("select set_config('test.role', 'service_role', false)");

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const must = async <T>(label: string, p: PromiseLike<{ data: T; error: unknown }>) => {
  const { data, error } = await p;
  if (error) { ng++; console.error("NG:", label, (error as { message?: string }).message); return null; }
  ok++;
  return data;
};

/* ── 片付け（何度流しても同じ結果になるように）──
   消すのは shim ではなく直接。アプリは消さないので shim にも DELETE は無い */
const CO = "aaaaaaaa-0000-0000-0000-000000000001";
const U1 = "aaaaaaaa-0000-0000-0000-000000000011"; // 担当者
const U2 = "aaaaaaaa-0000-0000-0000-000000000012"; // 受講者（修了）
const U3 = "aaaaaaaa-0000-0000-0000-000000000013"; // 受講者（途中）
const E2 = "aaaaaaaa-0000-0000-0000-000000000022";
const E3 = "aaaaaaaa-0000-0000-0000-000000000023";
const ORPHAN = "aaaaaaaa-0000-0000-0000-000000000099";
const PEOPLE = [U1, U2, U3, ORPHAN];

/* 注文は company を restrict で掴んでいるので、先に消す */
await raw.query("delete from public.orders where company_id = $1", [CO]);
await raw.query("delete from public.users where id = any($1::uuid[])", [PEOPLE]);
await raw.query("delete from public.companies where id = $1", [CO]);
await raw.query("delete from auth.users where id = any($1::uuid[])", [PEOPLE]);

/* ── 種を蒔く ──
   ログインの行を作ると、0004/0007 のトリガが public.users を作る。
   ここはその段取りごと確かめる（本番と同じ道筋） */
await raw.query(
  `insert into auth.users (id, email, raw_user_meta_data)
   select * from unnest($1::uuid[], $2::text[], $3::jsonb[])`,
  [
    PEOPLE,
    ["a@x", "s@x", "t@x", "o@x"],
    [
      JSON.stringify({ name: "青木（担当）" }),
      JSON.stringify({ name: "鈴木" }),
      JSON.stringify({ name: "田中" }),
      JSON.stringify({}),
    ],
  ],
);
{
  const made = await raw.query<{ id: string; name: string }>(
    "select id, name from public.users where id = any($1::uuid[]) order by name",
    [PEOPLE],
  );
  check(made.rowCount === 4, `登録すると受講者の行ができる（いま ${made.rowCount}）`);
  /* 外販なので、登録しただけの人はどこの事業者にも属さない。
     属していないと、修了証をどの会社の名義で出すか決まらない */
  const stray = await raw.query(
    "select count(*)::int as n from public.users where id = any($1::uuid[]) and company_id is not null",
    [PEOPLE],
  );
  check(stray.rows[0].n === 0, `登録しただけでは事業者に入らない（いま ${stray.rows[0].n}人）`);
  check(
    made.rows.some((r) => r.name === "鈴木"),
    "登録のときの氏名がそのまま入る",
  );
  check(
    made.rows.some((r) => r.name === "（氏名未登録）"),
    "氏名が無ければ仮の名前が入る",
  );
}

await must(
  "事業者を作る（名義と参加コードごと）",
  db.from("companies").insert({
    id: CO,
    name: "点検用工業",
    join_code: "ABCD2345",
    created_by: U1,
  }).select("id"),
);
/* この試験の事業者は、はじめは無償利用（席なしで修了証が出る側）。
   あとで有償に切り替えて、席と入金の決まりを確かめる */
await raw.query("update public.companies set trial = true where id = $1", [CO]);
{
  /* 参加コードは事業者ごとに1つ。他社と同じにはできない */
  const { error } = await db.from("companies").insert({ name: "よその会社", join_code: "ABCD2345" });
  check(!!error, "同じ参加コードは2社で使えない");
}
{
  /* 受講者はコードで自分の事業者を見つける */
  const { data } = await db.from("companies").select("id, name").eq("join_code", "ABCD2345").maybeSingle();
  check(data?.id === CO, "参加コードから事業者を引ける");
}
await must(
  "受講者を会社に入れる",
  db.from("users").update({ company_id: CO }).in("id", [U1, U2, U3]).select("id"),
);
await must("担当者を決める", db.from("users").update({ role: "admin" }).eq("id", U1).select("id"));
await must(
  "受講を作る",
  db.from("enrollments").insert([
    { id: E2, user_id: U2 },
    { id: E3, user_id: U3 },
  ]).select("id"),
);

/* 単元の番号は curriculum.json から入っている本物を使う（progress は lessons を参照する） */
const lessonRows = await raw.query<{ lesson_id: string }>(
  "select lesson_id from public.lessons order by sort_order",
);
const lessons = lessonRows.rows.map((r) => r.lesson_id);
check(lessons.length === 13, `単元が13件入っている（いま ${lessons.length}）`);

/* 学科：鈴木は13単元すべて合格、田中は3単元 */
await must(
  "視聴記録を作る",
  db.from("progress").insert([
    ...lessons.map((l) => ({ enrollment_id: E2, lesson_id: l, quiz_passed_at: "2026-01-01T00:00:00Z" })),
    ...lessons.slice(0, 3).map((l) => ({ enrollment_id: E3, lesson_id: l, quiz_passed_at: "2026-01-01T00:00:00Z" })),
    ...lessons.slice(3, 5).map((l) => ({ enrollment_id: E3, lesson_id: l, quiz_passed_at: null })),
  ]).select("id"),
);
await must(
  "修了試験を作る",
  db.from("exams").insert([
    { enrollment_id: E2, score: 12, total: 20, passed: false, attempt: 1 },
    { enrollment_id: E2, score: 19, total: 20, passed: true, attempt: 2 },
  ]).select("id"),
);

/* ── /api/training が書く形 ── */
await must(
  "実務の成績を書ける",
  db.from("training_attempts").insert([
    { enrollment_id: E2, chapter: "ch1", tutorial: true, sk: false, skill: 100, score: 9000, sec: 400, hints: 0, asks: 0, passed: true, errs: [] },
    { enrollment_id: E2, chapter: "ch1", tutorial: false, sk: false, skill: 91, score: 8200, sec: 380, hints: 1, asks: 0, passed: true,
      errs: [{ tag: "手摺の順", message: "低い方から入れんか", why: "体が隙間から抜ける" }] },
    { enrollment_id: E2, chapter: "ch2", tutorial: false, sk: false, skill: 55, score: 3000, sec: 500, hints: 3, asks: 2, passed: false, errs: [] },
  ]).select("id"),
);

/* 知らない章は入らない（check 制約） */
{
  const { error } = await db.from("training_attempts").insert({
    enrollment_id: E2, chapter: "ch9", skill: 50, score: 0, sec: 0, passed: false,
  });
  check(!!error, "知らない章はデータベースが拒む");
}
/* 技能点は0〜100 */
{
  const { error } = await db.from("training_attempts").insert({
    enrollment_id: E2, chapter: "ch1", skill: 120, score: 0, sec: 0, passed: false,
  });
  check(!!error, "技能点が100を超える行は入らない");
}

/* ── src/lib/admin.ts と同じ問い合わせ ── */
const me = await must("担当者を引ける", db.from("users").select("id, role, company_id").eq("id", U1).maybeSingle());
check(me?.role === "admin" && me?.company_id === CO, "担当者の所属と権限が読める");
const co = await must("事業者名を引ける", db.from("companies").select("name").eq("id", CO).maybeSingle());
check(co?.name === "点検用工業", "事業者名が読める");
const adminCount = await db.from("users").select("id", { count: "exact", head: true }).eq("role", "admin");
check((adminCount.count ?? 0) >= 1, "担当者の人数を数えられる");

/* ── /api/admin/summary と同じ問い合わせ ── */
const users = await must("自社の受講者を引ける", db.from("users").select("id, name, email, role").eq("company_id", CO));
check((users ?? []).length === 3, `自社の3人が出る（いま ${(users ?? []).length}）`);
const ids = (users ?? []).map((u) => u.id as string);

const enrollments = await must("受講を引ける", db.from("enrollments").select("id, user_id").in("user_id", ids));
const eids = (enrollments ?? []).map((e) => e.id as string);
check(eids.length === 2, `受講が2件（いま ${eids.length}）`);

const progress = await must("視聴記録を引ける", db.from("progress").select("enrollment_id, quiz_passed_at").in("enrollment_id", eids));
const exams = await must("修了試験を引ける", db.from("exams").select("enrollment_id, score, total, passed, created_at").in("enrollment_id", eids));
const attempts = await must("実務の成績を引ける", db.from("training_attempts").select("enrollment_id, chapter, tutorial, skill, passed, created_at").in("enrollment_id", eids));
const certs0 = await must("修了証を引ける", db.from("certificates").select("enrollment_id, cert_no, issued_at, revoked_at").in("enrollment_id", eids));
check((certs0 ?? []).length === 0, "まだ修了証は出ていない");

const rows = buildRoster({
  users: (users ?? []) as never,
  enrollments: (enrollments ?? []) as never,
  progress: (progress ?? []) as never,
  exams: (exams ?? []) as never,
  attempts: (attempts ?? []) as never,
  certs: [],
  lessonsTotal: 13,
});
const suzuki = rows.find((r) => r.name === "鈴木")!;
const tanaka = rows.find((r) => r.name === "田中")!;
const aoki = rows.find((r) => r.name.startsWith("青木"))!;
check(suzuki.lessonsPassed === 13, `鈴木は13単元（いま ${suzuki.lessonsPassed}）`);
check(suzuki.exam?.passed === true && suzuki.exam.score === 19, "鈴木は修了試験に合格（19点）");
check(suzuki.canIssue, "鈴木には修了証を出せる");
check(suzuki.training.find((t) => t.ch === "ch1")!.best === 91, "第1章の最高は本番の91点（チュートリアルは数えない）");
check(suzuki.training.find((t) => t.ch === "ch1")!.times === 1, "本番の回数は1回");
check(!suzuki.training.find((t) => t.ch === "ch2")!.passed, "第2章は55点で不合格");
check(tanaka.lessonsPassed === 3 && !tanaka.canIssue, "田中はまだ出せない");
check(aoki.admin && aoki.enrollmentId === null, "担当者は受講が無くても並ぶ");
check(rosterTotals(rows).waiting === 1, "未発行は1人");

/* ── 事業者は「名簿を分ける単位」。修了証の名義とは別（名義は決まっている）── */
{
  const en2 = await must("受講の持ち主", db.from("enrollments").select("user_id").eq("id", E2).maybeSingle());
  const owner2 = await must("持ち主の所属", db.from("users").select("company_id").eq("id", en2!.user_id as string).maybeSingle());
  check(owner2?.company_id === CO, "受講者がどの事業者の人か引ける");
}

/* ── 証明番号は、ぶつからない通し番号 ── */
{
  const nos = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db.rpc("next_cert_no");
    if (error) { ng++; console.error("NG: 証明番号を採れない", error.message); break; }
    nos.add(String(data));
  }
  check(nos.size === 5, `5回採って全部違う（いま ${nos.size}通り）`);
  const one = [...nos][0] ?? "";
  check(/^AT-\d{6}-\d{5}$/.test(one), `形が合っている（${one}）`);
}

/* ── /api/admin/cert と同じ問い合わせ ── */
const en = await must("受講の持ち主を引ける", db.from("enrollments").select("id, user_id").eq("id", E2).maybeSingle());
const owner = await must("持ち主の所属を引ける", db.from("users").select("company_id").eq("id", en!.user_id as string).maybeSingle());
check(owner?.company_id === CO, "自社の受講者だと分かる");

const passedExam = await must(
  "合格した修了試験を引ける",
  db.from("exams").select("id").eq("enrollment_id", E2).eq("passed", true).limit(1).maybeSingle(),
);
check(!!passedExam, "合格の記録が見つかる");

const certNo1 = String((await db.rpc("next_cert_no")).data);
await must(
  "修了証を出せる",
  db.from("certificates").insert({
    enrollment_id: E2, cert_no: certNo1, issued_at: "2026-01-05T00:00:00Z", issued_by: U1,
  }).select("id"),
);
{
  const { error } = await db.from("certificates").insert({
    enrollment_id: E2, cert_no: String((await db.rpc("next_cert_no")).data),
  });
  check(!!error, "有効な修了証は1受講に1枚まで");
}
const live = await must(
  "有効な修了証だけ引ける",
  db.from("certificates").select("cert_no").eq("enrollment_id", E2).is("revoked_at", null).maybeSingle(),
);
check(live?.cert_no === certNo1, "出した1枚が読める");

await must(
  "取り消せる",
  db.from("certificates").update({ revoked_at: "2026-01-06T00:00:00Z" })
    .eq("enrollment_id", E2).is("revoked_at", null).select("id"),
);
const gone = await db.from("certificates").select("cert_no").eq("enrollment_id", E2).is("revoked_at", null).maybeSingle();
check(!gone.data, "取り消したら有効な1枚は無くなる");
const kept = await db.from("certificates").select("cert_no").eq("enrollment_id", E2);
check((kept.data ?? []).length === 1, "取り消しても記録は残る");
await must(
  "取り消したあとは出し直せる",
  db.from("certificates").insert({
    enrollment_id: E2, cert_no: String((await db.rpc("next_cert_no")).data),
  }).select("id"),
);

/* ── /api/admin/role と同じ問い合わせ ── */
await must("担当者にできる", db.from("users").update({ role: "admin" }).eq("id", U2).select("id"));
const admins = await db.from("users").select("id", { count: "exact", head: true }).eq("company_id", CO).eq("role", "admin");
check((admins.count ?? 0) === 2, `担当者が2人になった（いま ${admins.count}）`);
await must("戻せる", db.from("users").update({ role: "learner" }).eq("id", U2).select("id"));

/* ── 所属の無い人をまとめて入れる（最初の1人を決めるとき）── */
/* ── 参加コードで事業者に入る（/api/join と同じ手順）── */
{
  const co = await must(
    "コードから事業者を探す",
    db.from("companies").select("id").eq("join_code", "ABCD2345").maybeSingle(),
  );
  await must(
    "その人を入れる",
    db.from("users").update({ company_id: co!.id as string }).eq("id", ORPHAN).select("id"),
  );
  const fixed = await db.from("users").select("company_id").eq("id", ORPHAN).maybeSingle();
  check(fixed.data?.company_id === CO, "参加コードを入れた人が名簿に入る");
}

/* ══ 申込みと席、そして修了証 ══
   ここが売り物の根っこ。入金が済むまで修了証を出さない。 */
console.log("");

/* ① 請求書払いの申込み。席はすぐ配るが、まだ入金前 */
const ord = await must(
  "注文を作れる",
  db.from("orders").insert({
    company_id: CO, seats: 3, unit_price: 3000, amount: 9900,
    method: "invoice", status: "pending",
    due_date: "2026-09-30", ordered_by: U1, bill_to: "点検用工業 経理部",
  }).select("id").single(),
);
const orderId = ord!.id as string;

const codes: string[] = [];
for (let i = 0; i < 3; i++) {
  const { data: c } = await db.rpc("gen_seat_code");
  codes.push(String(c));
  await must(`受講コード${i + 1}枚目を配れる`, db.from("seats").insert({ order_id: orderId, code: String(c) }).select("id"));
}
check(new Set(codes).size === 3, "3枚とも違うコード");
check(codes.every((c) => /^[2-9A-HJKMNP-Z]{12}$/.test(c)), `12文字・読み違えやすい字なし（${codes[0]}）`);
{
  const { error } = await db.from("seats").insert({ order_id: orderId, code: codes[0] });
  check(!!error, "同じ受講コードは2枚作れない");
}
{
  /* 期限は既定で1年後 */
  const { data } = await db.from("seats").select("expires_at").eq("code", codes[0]).maybeSingle();
  check(!!data?.expires_at, "受講コードに期限が入る");
}

/* ② 席を引き換える。会社に入り、受講に紐づく */
{
  const { data, error } = await db.rpc("redeem_seat", { p_code: codes[0], p_user: U3 });
  check(!error && data === CO, `引き換えると会社が返る（${error?.message ?? data}）`);
  const u = await db.from("users").select("company_id").eq("id", U3).maybeSingle();
  check(u.data?.company_id === CO, "引き換えた人が会社に入る");
  const s = await db.from("seats").select("used_by, used_at").eq("code", codes[0]).maybeSingle();
  check(s.data?.used_by === U3 && !!s.data?.used_at, "席が使用済みになる");
  const e = await db.from("enrollments").select("seat_id").eq("id", E3).maybeSingle();
  check(!!e.data?.seat_id, "受講に席が紐づく");
}
{
  /* 2人目が同じコードを入れても通らない */
  const { error } = await db.rpc("redeem_seat", { p_code: codes[0], p_user: U2 });
  check(!!error, "使われた受講コードは、ほかの人には使えない");
}
{
  const { error } = await db.rpc("redeem_seat", { p_code: "ZZZZZZZZZZZZ", p_user: U2 });
  check(!!error, "無いコードは断る");
}
{
  /* 期限切れは断る */
  await raw.query("update public.seats set expires_at = now() - interval '1 day' where code = $1", [codes[2]]);
  const { error } = await db.rpc("redeem_seat", { p_code: codes[2], p_user: U2 });
  check(!!error && /期限/.test(error.message), `期限切れは断る（${error?.message}）`);
  await raw.query("update public.seats set expires_at = now() + interval '1 year' where code = $1", [codes[2]]);
}

/* ②' 買った受講コードを、配れる形で取り出せる。
   数だけ返しても担当者は受講者に配れない（コードの文字が要る） */
{
  const rows = await listSeats(db, [{ id: orderId, status: "pending" }]);
  check(rows.length === 3, `席を3枚とも取り出せる（${rows.length}）`);
  check(rows.every((r) => /^[2-9A-HJKMNP-Z]{12}$/.test(r.code)), "コードの文字そのものが返る");
  check(!rows[0].usedAt && !rows[1].usedAt, "まだ配っていないものが先に出る");
  const u = rows.find((r) => r.usedAt);
  check(u?.code === codes[0], "使用済みの行が使った席と一致する");
  check(u?.usedBy === "田中", `使った人の氏名が出る（${u?.usedBy}）`);
  check(rows.every((r) => r.status === "pending"), "元の注文の状態が付く");
  check(rows.every((r) => !!r.expiresAt), "期限が付く");
  const none = await listSeats(db, []);
  check(none.length === 0, "注文が無ければ空");
}

/* ②'' 受講コードを引き換えた人だけが、学科と実務トレーニングを開ける。
   ここを通してしまうと、登録しただけの人に教材が全部見えてしまう */
{
  /* いまは無償利用の会社なので、席が無くても開ける（試用・社内利用） */
  await raw.query("update public.companies set trial = true where id = $1", [CO]);
  const t = await learnFor(db, U2);
  check(t.ok && t.by === "trial", `無償利用の会社の人は開ける（${JSON.stringify(t)}）`);

  /* 有償に戻すと、席を引き換えた人だけになる */
  await raw.query("update public.companies set trial = false where id = $1", [CO]);
  const yes = await learnFor(db, U3); // codes[0] を引き換え済み
  check(yes.ok && yes.by === "seat", `席を引き換えた人は開ける（${JSON.stringify(yes)}）`);

  const no = await learnFor(db, U2); // 名簿には居るが席が無い
  check(!no.ok && no.why === "seat", `席が無ければ開けない（${JSON.stringify(no)}）`);
  check(!no.ok && no.company === "点検用工業", "断るときも、どの会社に居るかは出す");

  /* 参加コードで名簿に入っただけでは受講できない。
     担当者（role=admin）でも同じ。登録すれば誰でも担当者になれてしまうため */
  await raw.query("update public.users set role = 'admin' where id = $1", [U2]);
  const adm = await learnFor(db, U2);
  check(!adm.ok, "担当者でも、席が無ければ開けない");
  await raw.query("update public.users set role = 'learner' where id = $1", [U2]);

  /* どこの会社にも属していない人（登録しただけ） */
  const lone = await learnFor(db, ORPHAN);
  check(!lone.ok && lone.why === "seat", `登録しただけでは開けない（${JSON.stringify(lone)}）`);

  await raw.query("update public.companies set trial = true where id = $1", [CO]);
}

/* ③ 入金前は修了証を出せない */
await raw.query("update public.companies set trial = false where id = $1", [CO]);
await raw.query("delete from public.certificates where enrollment_id = $1", [E2]);
{
  /* E2（鈴木）は学科を終えているが、席が無い。無償利用でもない */
  const { error } = await db.from("certificates").insert({
    enrollment_id: E2, cert_no: String((await db.rpc("next_cert_no")).data),
  });
  check(!!error && /受講コード/.test(error.message), `席が無ければ出せない（${error?.message}）`);
}
{
  /* 席を渡す。ただし注文はまだ入金待ち */
  await raw.query("update public.enrollments set seat_id = (select id from public.seats where code = $1) where id = $2", [codes[1], E2]);
  const { error } = await db.from("certificates").insert({
    enrollment_id: E2, cert_no: String((await db.rpc("next_cert_no")).data),
  });
  check(!!error && /未入金/.test(error.message), `未入金では出せない（${error?.message}）`);
}

/* ④ 入金を確認したら出せる */
await must(
  "入金済みにできる",
  db.from("orders").update({ status: "paid", paid_at: new Date(0).toISOString() }).eq("id", orderId).select("id"),
);
{
  const no = String((await db.rpc("next_cert_no")).data);
  const { error } = await db.from("certificates").insert({ enrollment_id: E2, cert_no: no });
  check(!error, `入金後は出せる（${error?.message ?? no}）`);
}

/* ⑤ 無償利用の事業者は、席が無くても出せる */
await raw.query("update public.companies set trial = true where id = $1", [CO]);
await raw.query("delete from public.certificates where enrollment_id = $1", [E2]);
await raw.query("update public.enrollments set seat_id = null where id = $1", [E2]);
{
  const { error } = await db.from("certificates").insert({
    enrollment_id: E2, cert_no: String((await db.rpc("next_cert_no")).data),
  });
  check(!error, `無償利用なら席が無くても出せる（${error?.message ?? "ok"}）`);
}

/* ⑥ 入金済みと入金日時は必ず対で入る */
{
  const { error } = await raw.query(
    "update public.orders set status = 'paid', paid_at = null where id = $1", [orderId],
  ).then(() => ({ error: null })).catch((e: Error) => ({ error: e }));
  check(!!error, "入金済みなのに入金日時が無い行は入らない");
}

await raw.end();

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
