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

await raw.end();

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
