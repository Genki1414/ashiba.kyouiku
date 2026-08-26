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
import { listSeats, releaseSeat } from "@/lib/seats";
import { learnFor } from "@/lib/entitleQuery";
import { companyRecords } from "@/lib/records";
import { heldFor, heldForMany } from "@/lib/quals";
import { buildCheck, checkTotals } from "@/training/verifyLog";

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
/* 在籍も起こす。本番では join_company / redeem_seat を通るので必ず立つ */
for (const u of [U1, U2, U3]) {
  const r = await db.rpc("join_company", { p_user: u, p_company: CO });
  if (r.error) { ng++; console.error("NG: 在籍を起こす", r.error.message); } else ok++;
}
await must("担当者を決める", db.from("users").update({ role: "admin" }).eq("id", U1).select("id"));
await must(
  "受講を作る",
  db.from("enrollments").insert([
    { id: E2, user_id: U2, course_id: "ashiba", company_id: CO },
    { id: E3, user_id: U3, course_id: "ashiba", company_id: CO },
  ]).select("id"),
);

/* 単元の番号は curriculum.json から入っている本物を使う（progress は lessons を参照する） */
const lessonRows = await raw.query<{ lesson_id: string }>(
  "select lesson_id from public.lessons where course_id = 'ashiba' order by sort_order",
);
const lessons = lessonRows.rows.map((r) => r.lesson_id);
check(lessons.length === 13, `単元が13件入っている（いま ${lessons.length}）`);
check(lessons.every((l) => l.startsWith("ashiba:")),
  `単元IDに講座が付いている（${lessons[0]}）`);

/* 学科：鈴木は13単元すべて合格、田中は3単元 */
await must(
  "視聴記録を作る",
  db.from("progress").insert([
    ...lessons.map((l) => ({ enrollment_id: E2, lesson_id: l, watched_sec: 1800, quiz_passed_at: "2026-01-01T00:00:00Z" })),
    ...lessons.slice(0, 3).map((l) => ({ enrollment_id: E3, lesson_id: l, watched_sec: 1800, quiz_passed_at: "2026-01-01T00:00:00Z" })),
    ...lessons.slice(3, 5).map((l, i) => ({
      enrollment_id: E3, lesson_id: l, quiz_passed_at: null,
      /* 4単元目は途中まで見ている。担当者の画面に「いまここ」を出すため */
      watched_sec: i === 0 ? 600 : 0,
    })),
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

/* ── 講座（0011）──
   特別教育は種類が増えていく。取り違えると別の講座の記録が混ざる */
{
  const courses = await must("講座を引ける", db.from("courses").select("id, name"));
  check((courses ?? []).some((c) => c.id === "ashiba"), "足場の講座が入っている");

  const l = await must("単元は講座ごと",
    db.from("lessons").select("lesson_id, course_id").eq("course_id", "ashiba").limit(1));
  check((l ?? [])[0]?.lesson_id?.toString().startsWith("ashiba:"), "単元IDに講座が付く");

  /* 受講は1人1講座につき1件。同じ講座で2件は作れない */
  const dup = await db.from("enrollments").insert({ user_id: U2, course_id: "ashiba" });
  check(!!dup.error, "同じ人・同じ講座で受講は2件作れない");

  /* 無い講座は断る */
  const bad = await db.rpc("enrollment_for", { p_user: U2, p_course: "nonsense" });
  check(!!bad.error, "無い講座の受講は作れない");

  /* 有る講座なら、取れなければ作って返す */
  const got = await db.rpc("enrollment_for", { p_user: U2, p_course: "ashiba" });
  check(!got.error && got.data === E2, `その人・その講座の受講を返す（${got.data}）`);
}

/* ── 在籍（0012）──
   人は辞めるし、よその会社へ移る。移っても、前の会社で受けた記録は
   前の会社に残らないと困る（教育を行った事業者が3年保存する決まり） */
{
  const mem = await must("在籍を引ける",
    db.from("memberships").select("user_id, company_id, approved_at, left_at").eq("company_id", CO));
  check((mem ?? []).length >= 3, `在籍が起きている（${(mem ?? []).length}件）`);
  check((mem ?? []).every((m) => !m.left_at), "はじめは全員が在籍中");
  check((mem ?? []).every((m) => m.approved_at), "既にいる人は許可済みとして起こす");

  /* ① 受講者が自分で申し込む。この時点ではまだ入っていない */
  const asked = await db.rpc("request_membership", { p_user: ORPHAN, p_company: CO });
  check(!asked.error, `申し込める（${asked.error?.message ?? "ok"}）`);
  const pend = await db.from("memberships").select("approved_at").eq("user_id", ORPHAN).eq("company_id", CO).is("left_at", null).maybeSingle();
  check(!!pend.data && !pend.data.approved_at, "申し込んだだけでは許可が下りていない");
  const notYet = await db.from("users").select("company_id").eq("id", ORPHAN).maybeSingle();
  check(!notYet.data?.company_id, "許可が下りるまで、所属は空のまま");

  /* 申し込んだだけの人は、名簿の「在籍」に入ってはいけない。
     ここを left_at だけで見ていたので、許可前から在籍になっていた */
  {
    const asActive = await must(
      "在籍を引く（/api/admin/summary と同じ）",
      db.from("memberships").select("user_id")
        .eq("company_id", CO).not("approved_at", "is", null).is("left_at", null),
    );
    const ids = (asActive ?? []).map((m) => m.user_id as string);
    check(!ids.includes(ORPHAN), "申し込んだだけの人は在籍に入らない");
    check(ids.includes(U2), "許可済みの人は在籍に入る");
  }

  /* 断ったあとでも、もう一度許可できる（押し間違いを戻せる）。
     直近30日の「断った申し込み」として画面に出す引き方 */
  {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.rpc("leave_company", { p_user: ORPHAN, p_company: CO });
    const refused = await must(
      "断った申し込みを引ける",
      db.from("memberships").select("user_id")
        .eq("company_id", CO).is("approved_at", null).gte("left_at", since),
    );
    check((refused ?? []).some((m) => m.user_id === ORPHAN), "断った申し込みが出る");
    const again = await db.rpc("join_company", { p_user: ORPHAN, p_company: CO });
    check(!again.error, "断ったあとでも許可できる");
    const back = await db.from("memberships").select("id")
      .eq("user_id", ORPHAN).eq("company_id", CO).not("approved_at", "is", null).is("left_at", null);
    check((back.data ?? []).length === 1, "許可し直すと在籍に戻る");
    /* あとの点検のため、申し込み中の状態に戻す */
    await db.rpc("leave_company", { p_user: ORPHAN, p_company: CO });
    await db.rpc("request_membership", { p_user: ORPHAN, p_company: CO });
  }

  /* 二度押しても増えない */
  await db.rpc("request_membership", { p_user: ORPHAN, p_company: CO });
  const once = await db.from("memberships").select("id").eq("user_id", ORPHAN).is("left_at", null);
  check((once.data ?? []).length === 1, "二度申し込んでも1件");

  /* ② 会社が許可する */
  const okd = await db.rpc("join_company", { p_user: ORPHAN, p_company: CO });
  check(!okd.error, "許可できる");
  const now2 = await db.from("memberships").select("approved_at").eq("user_id", ORPHAN).eq("company_id", CO).is("left_at", null).maybeSingle();
  check(!!now2.data?.approved_at, "許可した日が入る");
  const joined = await db.from("users").select("company_id").eq("id", ORPHAN).maybeSingle();
  check(joined.data?.company_id === CO, "許可されて名簿に入る");

  /* ③ 断る（＝申し込みを閉じる）。許可は要らない */
  await db.rpc("leave_company", { p_user: ORPHAN, p_company: CO });
  await db.rpc("request_membership", { p_user: ORPHAN, p_company: CO });
  await db.rpc("leave_company", { p_user: ORPHAN, p_company: CO });
  const closed = await db.from("memberships").select("id").eq("user_id", ORPHAN).is("left_at", null);
  check((closed.data ?? []).length === 0, "断れば、開いている申し込みは無くなる");
  const hist = await db.from("memberships").select("id").eq("user_id", ORPHAN);
  check((hist.data ?? []).length >= 2, "断った記録は残る");

  /* 無い会社には申し込めない */
  const nope = await db.rpc("request_membership", {
    p_user: ORPHAN, p_company: "aaaaaaaa-0000-0000-0000-0000000000fe",
  });
  check(!!nope.error, "無い事業者には申し込めない");

  /* 退職。記録は消さない */
  const bye = await db.rpc("leave_company", { p_user: U3, p_company: CO });
  check(!bye.error, `退職にできる（${bye.error?.message ?? "ok"}）`);
  const after = await db.from("memberships").select("left_at").eq("user_id", U3).eq("company_id", CO).maybeSingle();
  check(!!after.data?.left_at, "抜けた日が入る");
  const u3 = await db.from("users").select("company_id").eq("id", U3).maybeSingle();
  check(!u3.data?.company_id, "いまの所属は空になる");
  const kept = await db.from("enrollments").select("company_id").eq("id", E3).maybeSingle();
  check(kept.data?.company_id === CO, "受けた記録は、その会社に残る");

  /* 戻す */
  const back = await db.rpc("join_company", { p_user: U3, p_company: CO });
  check(!back.error, "在籍に戻せる");
  const again = await db.from("memberships").select("id").eq("user_id", U3).is("left_at", null);
  check((again.data ?? []).length === 1, "在籍中は1件だけ");

  /* 転職。よその会社のコードを入れたら、前の在籍は閉じる */
  const other = await must("よその会社",
    db.from("companies").insert({ name: "よその工業", responsible_name: "山田" }).select("id").single());
  const moved = await db.rpc("join_company", { p_user: U3, p_company: other!.id as string });
  check(!moved.error, "よその会社へ移れる");
  const nowIn = await db.from("memberships").select("company_id, left_at").eq("user_id", U3).is("left_at", null);
  check((nowIn.data ?? []).length === 1 && nowIn.data![0].company_id === other!.id,
    "在籍中はよその会社1件だけ");
  /* 出たり入ったりしているので、開いている在籍が無いことで見る */
  const oldOne = await db.from("memberships").select("id").eq("user_id", U3).eq("company_id", CO).is("left_at", null);
  check((oldOne.data ?? []).length === 0, "前の会社の在籍は閉じている");
  const stillMine = await db.from("enrollments").select("company_id").eq("id", E3).maybeSingle();
  check(stillMine.data?.company_id === CO, "移っても、前の会社で受けた記録は前の会社のまま");

  /* 元に戻しておく（あとの点検のため） */
  await db.rpc("join_company", { p_user: U3, p_company: CO });
  await raw.query("delete from public.memberships where company_id = $1", [other!.id]);
  await raw.query("delete from public.companies where id = $1", [other!.id]);

  /* 無い会社には入れない */
  const bad = await db.rpc("join_company", {
    p_user: U3, p_company: "aaaaaaaa-0000-0000-0000-0000000000ff",
  });
  check(!!bad.error, "無い事業者には入れない");
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

const progress = await must("視聴記録を引ける", db.from("progress").select("enrollment_id, lesson_id, watched_sec, quiz_passed_at").in("enrollment_id", eids));
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
  /* 本物の並びを渡す。「いま何番目の途中か」はこの順で決まる */
  lessons: lessons.map((id, i) => ({ id, title: `単元${i + 1}`, legal_min: 30 })),
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
check(tanaka.watchedSec === 3 * 1800 + 600, `田中の見た時間は合計で出る（${tanaka.watchedSec}秒）`);
check(tanaka.now?.id === lessons[3] && tanaka.now?.watchedSec === 600,
  `田中は4単元目の途中と分かる（${JSON.stringify(tanaka.now)}）`);
check(suzuki.now === null, "全単元を終えた鈴木には「いまここ」が無い");
check(suzuki.requiredSec === 13 * 1800, "法定の合計が入る");
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
    company_id: CO, course_id: "ashiba", seats: 3, unit_price: 3000, amount: 9900,
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
  const rows = await listSeats(db, [{ id: orderId, status: "pending", course_id: "ashiba" }]);
  check(rows.length === 3, `席を3枚とも取り出せる（${rows.length}）`);
  check(rows.every((r) => /^[2-9A-HJKMNP-Z]{12}$/.test(r.code)), "コードの文字そのものが返る");
  check(!rows[0].usedAt && !rows[1].usedAt, "まだ配っていないものが先に出る");
  const u = rows.find((r) => r.usedAt);
  check(u?.code === codes[0], "使用済みの行が使った席と一致する");
  check(u?.usedBy === "田中", `使った人の氏名が出る（${u?.usedBy}）`);
  check(rows.every((r) => r.status === "pending"), "元の注文の状態が付く");
  check(rows.every((r) => r.courseId === "ashiba"), "どの講座の席かが付く");
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

/* ②-2 無償利用は「在籍している人」だけ。
   会社の名前は誰でも探せるので、申し込んだだけで通してしまうと、
   無償利用の会社を見つけて申し込むだけで教材が開いてしまう。
   抜けた人も同じ。無償利用を切れば、その場で通らなくなる */
{
  await raw.query("update public.companies set trial = true where id = $1", [CO]);

  const inn = await learnFor(db, U2);
  check(inn.ok && inn.by === "trial", `無償利用に在籍していれば開ける（${JSON.stringify(inn)}）`);

  /* 申し込んだだけ（許可が下りていない）。控えの users.company_id も持たない */
  await raw.query("delete from public.memberships where user_id = $1", [ORPHAN]);
  await raw.query("update public.users set company_id = null where id = $1", [ORPHAN]);
  const r = await db.rpc("request_membership", { p_user: ORPHAN, p_company: CO });
  check(!r.error, `申し込みを立てられる（${r.error?.message ?? "ok"}）`);
  const asked = await learnFor(db, ORPHAN);
  check(!asked.ok, `申し込んだだけでは開けない（${JSON.stringify(asked)}）`);

  /* 許可すれば開く */
  await db.rpc("join_company", { p_user: ORPHAN, p_company: CO });
  const joined = await learnFor(db, ORPHAN);
  check(joined.ok && joined.by === "trial", `許可が下りれば開ける（${JSON.stringify(joined)}）`);

  /* 抜けたら、また開かなくなる。記録は残る */
  await db.rpc("leave_company", { p_user: ORPHAN, p_company: CO });
  const gone = await learnFor(db, ORPHAN);
  check(!gone.ok, `抜けたら開けない（${JSON.stringify(gone)}）`);
  const kept = await raw.query(
    "select count(*)::int as n from public.memberships where user_id = $1 and company_id = $2",
    [ORPHAN, CO],
  );
  check(kept.rows[0].n >= 1, `抜けても紐付けの記録は消えない（いま ${kept.rows[0].n}件）`);

  /* 無償利用を切ると、在籍していても開かない（「無償利用中のみ」） */
  await raw.query("update public.companies set trial = false where id = $1", [CO]);
  const off = await learnFor(db, U2);
  check(!off.ok, `無償利用を切れば、在籍していても開けない（${JSON.stringify(off)}）`);
  await raw.query("update public.companies set trial = true where id = $1", [CO]);
}

/* ②-3 事業者を作った人にも在籍が立つ。
   users.company_id を直に書くだけだと在籍が立たず、
   作った本人が自分の名簿にも出ず、無償利用の判定からも漏れる。

   作る側（/api/admin/setup）は join_company を通すように直した。
   ここでは 0014 の埋め戻しが、それより前に作られたぶんを拾えるかを見る */
{
  const n = await raw.query(
    `select count(*)::int as n from public.memberships
      where user_id = $1 and company_id = $2 and approved_at is not null and left_at is null`,
    [U1, CO],
  );
  check(n.rows[0].n === 1, `事業者を作った担当者に在籍が立っている（いま ${n.rows[0].n}件）`);

  /* 直す前の形を作る。在籍を消して、控えだけ残す */
  await raw.query("delete from public.memberships where user_id = $1 and company_id = $2", [U1, CO]);
  await raw.query("update public.users set company_id = $2 where id = $1", [U1, CO]);
  const broken = await learnFor(db, U1);
  check(
    (await raw.query(
      "select count(*)::int as n from public.memberships where user_id = $1", [U1],
    )).rows[0].n === 0,
    "直す前の形（在籍なし・控えだけ）を作れた",
  );
  check(broken.ok, "控えが残っていれば、直す前の形でも締め出さない（受け皿）");

  /* 0014 の埋め戻し。何度流しても増えない */
  const backfill = `
    insert into public.memberships (user_id, company_id, approved_at)
    select u.id, u.company_id, now() from public.users u
     where u.company_id is not null
       and not exists (select 1 from public.memberships m
                        where m.user_id = u.id and m.left_at is null);
    insert into public.memberships (user_id, company_id, approved_at)
    select c.created_by, c.id, now() from public.companies c
     where c.created_by is not null
       and not exists (select 1 from public.memberships m
                        where m.user_id = c.created_by and m.left_at is null);`;
  await raw.query(backfill);
  const after = await raw.query(
    `select count(*)::int as n from public.memberships
      where user_id = $1 and company_id = $2 and approved_at is not null and left_at is null`,
    [U1, CO],
  );
  check(after.rows[0].n === 1, `埋め戻しで在籍が立つ（いま ${after.rows[0].n}件）`);
  await raw.query(backfill);
  const twice = await raw.query(
    "select count(*)::int as n from public.memberships where user_id = $1 and company_id = $2",
    [U1, CO],
  );
  check(twice.rows[0].n === 1, `2回流しても増えない（いま ${twice.rows[0].n}件）`);
}

/* ②-4 本部の元帳（/api/owner/ledger と同じ問い合わせ）。
   担当者の名簿からは抜けた人を外したので、
   辞めた人の分を後から示せるのは、ここだけになる */
{
  /* 田中（U3）を辞めさせる。この会社の席で受けた記録は残っているはず */
  await db.rpc("leave_company", { p_user: U3, p_company: CO });

  const { data: mems } = await db
    .from("memberships")
    .select("user_id, requested_at, approved_at, left_at")
    .eq("company_id", CO);
  const { data: ens } = await db
    .from("enrollments")
    .select("id, user_id, course_id, seat_id, closed_at")
    .eq("company_id", CO);

  const ids = [...new Set([
    ...(mems ?? []).map((m) => m.user_id as string),
    ...(ens ?? []).map((e) => e.user_id as string),
  ])];
  check(ids.includes(U3), "辞めた人も、元帳には出る");
  check(
    (ens ?? []).some((e) => e.user_id === U3),
    "辞めた人の受講記録が、その会社ぶんとして残っている",
  );
  const left = (mems ?? []).find((m) => m.user_id === U3 && m.left_at);
  check(!!left, "いつ抜けたかも残っている");

  /* 担当者の名簿からは消えている（そちらは「表示しない」にした） */
  const { data: active } = await db
    .from("memberships")
    .select("user_id")
    .eq("company_id", CO)
    .not("approved_at", "is", null)
    .is("left_at", null);
  check(
    !(active ?? []).some((m) => m.user_id === U3),
    "辞めた人は在籍には出ない",
  );

  /* 組み立てた形も見る。本部（/api/owner/ledger）と
     その会社の担当者（/api/admin/past）は、同じものを使う */
  const led = await companyRecords(db, CO);
  const t = led.people.find((p) => p.userId === U3);
  check(!!t, "辞めた人が元帳の一覧に入る");
  check(t?.state === "退職", `辞めた人の状態は退職（いま ${t?.state}）`);
  check(!!t?.leftAt, "いつ辞めたかが入る");
  check((t?.records.length ?? 0) >= 1, `辞めた人の受講記録が残る（いま ${t?.records.length}件）`);
  check(led.totals.gone >= 1, `退職の数が出る（いま ${led.totals.gone}人）`);
  check(
    led.people.every((p) => p.name.length > 0 || p.email.length > 0),
    "誰の記録かが分かる（氏名かメールが入る）",
  );
  /* 在籍が上、退職が下。監督署に出すときに並びが揃っていないと読めない */
  const order = led.people.map((p) => p.state);
  const first = order.indexOf("退職");
  check(
    first === -1 || !order.slice(first).includes("在籍"),
    `在籍が先で退職が後（${order.join("・")}）`,
  );

  /* 戻す。あとの試験がこの人を使う */
  await db.rpc("join_company", { p_user: U3, p_company: CO });
}

/* ②-4b 修了証を触れるのは「受けさせた会社」。
   人がいまどこに居るかで見ると、
     ・辞めた人の修了証を、受けさせた会社が出せなくなる
     ・よそへ移った人の記録を、移った先の会社が触れてしまう
   修了証はその教育を行った事業者の名義で出るので、どちらも困る */
{
  const other = "aaaaaaaa-0000-0000-0000-0000000000c3";
  await raw.query("delete from public.companies where id = $1", [other]);
  await raw.query(
    "insert into public.companies (id, name, join_code) values ($1, '転職先工業', 'YYYY8765')",
    [other],
  );

  /* /api/admin/cert が見ているもの（受講が持つ会社）と、
     見てはいけないもの（人がいまどこに居るか）を、両方引いてみる */
  const seen = async (enrollmentId: string) => {
    const { data: en } = await db
      .from("enrollments")
      .select("id, user_id, company_id")
      .eq("id", enrollmentId)
      .maybeSingle();
    const { data: u } = await db
      .from("users")
      .select("company_id")
      .eq("id", en?.user_id as string)
      .maybeSingle();
    return { byEnrollment: en?.company_id ?? null, byUser: u?.company_id ?? null };
  };

  const before = await seen(E2);
  check(before.byEnrollment === CO, `受けた会社が受講に入っている（${before.byEnrollment}）`);

  /* 鈴木（U2）が転職する */
  await db.rpc("join_company", { p_user: U2, p_company: other });
  const after = await seen(E2);
  check(after.byEnrollment === CO, "転職しても、受けた会社は変わらない");
  check(after.byUser === other, `いまの所属は移る（${after.byUser}）`);
  check(
    after.byEnrollment !== after.byUser,
    "この2つは食い違う。人の側で見ると、転職先が前の会社の記録を触れてしまう",
  );

  /* 元の会社に戻す。あとの試験がこの人を使う */
  await db.rpc("join_company", { p_user: U2, p_company: CO });
  await raw.query("delete from public.memberships where company_id = $1", [other]);
  await raw.query("delete from public.companies where id = $1", [other]);
  const back = await seen(E2);
  check(back.byEnrollment === CO && back.byUser === CO, "戻した");
}

/* ②-4c よそで取った資格（自己申告）。
   足場の職人が持っているものは、この仕組みの外で取ったものが多い。
   前の会社で受けた特別教育を受け直させる決まりは無いが、
   事業者は「受けている」ことを確かめないと就かせられない */
{
  await raw.query("delete from public.held_quals where user_id = any($1::uuid[])", [PEOPLE]);

  const add = (u: string, q: string, o: Record<string, unknown> = {}) =>
    db.rpc("add_qual", {
      p_user: u, p_qual: q,
      p_label: (o.label as string) ?? null,
      p_issuer: (o.issuer as string) ?? null,
      p_got: (o.got as string) ?? null,
      p_cert: (o.cert as string) ?? null,
    });

  const r1 = await add(U2, "sk-sling", { issuer: "前の会社", got: "2024-05-01", cert: "A-1" });
  check(!r1.error, `一覧にある資格を足せる（${r1.error?.message ?? "ok"}）`);

  const mine = await heldFor(db, U2);
  check(mine.length === 1, `1件入る（いま ${mine.length}件）`);
  check(mine[0].name.includes("玉掛け"), `名前は一覧から出す（${mine[0].name}）`);
  check(mine[0].kind === "技能講習", `種類も出る（${mine[0].kind}）`);
  check(mine[0].issuer === "前の会社", "どこで受けたかが残る");
  check(mine[0].confirmedAt === null, "足しただけでは自己申告のまま");

  /* 同じものを足しても増えない。書き足しになる */
  const r2 = await add(U2, "sk-sling", { issuer: "別の教習所", got: "2024-06-01" });
  check(!r2.error, "同じ資格をもう一度足せる（書き足し）");
  const again = await heldFor(db, U2);
  check(again.length === 1, `二重に増えない（いま ${again.length}件）`);
  check(again[0].issuer === "別の教習所", "中身は新しい方になる");

  /* 一覧に無いものは、名前を書かないと入らない */
  const bad = await add(U2, "other");
  check(!!bad.error, "その他は、名前が無ければ断る");
  const own = await add(U2, "other", { label: "うちの独自講習" });
  check(!own.error, `その他は名前を書けば入る（${own.error?.message ?? "ok"}）`);

  /* ── 確かめる ── */
  const held = await heldFor(db, U2);
  const sling = held.find((h) => h.name.includes("玉掛け"))!;
  const okc = await db.rpc("confirm_qual", {
    p_id: sling.id, p_company: CO, p_admin: U1, p_on: true,
  });
  check(!okc.error && okc.data === true, `在籍している人のぶんは確かめられる（${okc.error?.message ?? "ok"}）`);
  const after = await heldFor(db, U2);
  check(!!after.find((h) => h.id === sling.id)?.confirmedAt, "確認済みの日が入る");

  /* よその会社は押せない。押せると、自己申告に勝手な裏書きが付く */
  const other = "aaaaaaaa-0000-0000-0000-0000000000c4";
  await raw.query("delete from public.companies where id = $1", [other]);
  await raw.query(
    "insert into public.companies (id, name, join_code) values ($1, 'よその会社', 'XXXX7654')",
    [other],
  );
  const ngc = await db.rpc("confirm_qual", {
    p_id: sling.id, p_company: other, p_admin: U1, p_on: true,
  });
  check(!!ngc.error, "在籍していない会社は確かめられない");
  await raw.query("delete from public.companies where id = $1", [other]);

  /* 中身を書き換えたら、確かめた印は落ちる。
     確かめたのは「そのとき見せられた紙」なので、書き換えたら確かめ直す */
  await add(U2, "sk-sling", { issuer: "書き換えた", got: "2024-07-01" });
  const redo = await heldFor(db, U2);
  check(
    redo.find((h) => h.id === sling.id)?.confirmedAt === null,
    "中身を直すと、確認済みは落ちる",
  );

  /* ── 外す ── */
  const drop = await db.rpc("drop_qual", { p_user: U2, p_id: sling.id });
  check(!drop.error, `自分のぶんは外せる（${drop.error?.message ?? "ok"}）`);
  check((await heldFor(db, U2)).length === 1, "外れた（その他だけ残る）");

  /* よその人のぶんは外せない。id を書き換えても消えない */
  const mine2 = await heldFor(db, U2);
  await db.rpc("drop_qual", { p_user: U3, p_id: mine2[0].id });
  check((await heldFor(db, U2)).length === 1, "よその人のぶんは外せない");

  /* ── まとめて引く（名簿はこちらを使う）── */
  await add(U3, "se-harness", { issuer: "教習所" });
  const many = await heldForMany(db, [U2, U3, ORPHAN]);
  check(many.get(U2)?.length === 1, `まとめて引ける・U2（${many.get(U2)?.length}）`);
  check(many.get(U3)?.length === 1, `まとめて引ける・U3（${many.get(U3)?.length}）`);
  check(!many.has(ORPHAN), "持っていない人は入らない");
  check(
    (await heldForMany(db, [])).size === 0,
    "誰も居なければ引きに行かない",
  );

  await raw.query("delete from public.held_quals where user_id = any($1::uuid[])", [PEOPLE]);
}

/* ②-5 元帳は事業者ごとに分かれている。
   よその会社の記録が混ざると、そのまま監督署に出してしまう */
{
  const other = "aaaaaaaa-0000-0000-0000-0000000000c2";
  await raw.query("delete from public.companies where id = $1", [other]);
  await raw.query(
    "insert into public.companies (id, name, join_code) values ($1, 'よその工業', 'ZZZZ9876')",
    [other],
  );
  const mine = await companyRecords(db, CO);
  const theirs = await companyRecords(db, other);
  check(theirs.people.length === 0, `関わりの無い事業者は空（いま ${theirs.people.length}人）`);
  check(mine.people.length > 0, `自分の事業者ぶんは出る（いま ${mine.people.length}人）`);
  await raw.query("delete from public.companies where id = $1", [other]);
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

/* ⑦ 引き換えの取り消し。
   違う人がコードを入れてしまったとき、担当者が席を戻せないと
   買った枚数が減ったままどうにもできない */
{
  /* 使っていない席は戻せない */
  const notUsed = await releaseSeat(db, codes[2], CO);
  check(!notUsed.ok, `まだ使われていない席は戻せない（${JSON.stringify(notUsed)}）`);

  /* 無いコードも断る */
  const none = await releaseSeat(db, "ZZZZZZZZZZZZ", CO);
  check(!none.ok, "無いコードは断る");

  /* よその事業者の席は触らせない */
  const other = await releaseSeat(db, codes[0], "aaaaaaaa-0000-0000-0000-0000000000ff");
  check(!other.ok && /よその/.test(other.reason), `よその事業者の席は戻せない（${JSON.stringify(other)}）`);

  /* 修了証を出した人の席は戻せない（席の無い修了証が残ってしまう） */
  await raw.query("update public.enrollments set seat_id = (select id from public.seats where code = $1) where id = $2", [codes[1], E2]);
  await raw.query("delete from public.certificates where enrollment_id = $1", [E2]);
  await must("修了証を出す", db.from("certificates").insert({
    enrollment_id: E2, cert_no: String((await db.rpc("next_cert_no")).data),
  }).select("id"));
  await raw.query("update public.seats set used_by = $1, used_at = now() where code = $2", [U2, codes[1]]);
  const certified = await releaseSeat(db, codes[1], CO);
  check(!certified.ok && /修了証/.test(certified.reason), `修了証を出した人の席は戻せない（${JSON.stringify(certified)}）`);

  /* 取り消したあとなら戻せる */
  await raw.query("update public.certificates set revoked_at = now() where enrollment_id = $1", [E2]);
  /* 受講中の記録も入れておく。取り消しで消えないことを見るため */
  await raw.query(
    "insert into public.verify_logs (enrollment_id, lesson_id, result, reason) values ($1,'ashiba:1-1','ng','no_face')",
    [E2],
  );
  const after = await releaseSeat(db, codes[1], CO);
  check(after.ok, `修了証を取り消したあとなら戻せる（${JSON.stringify(after)}）`);

  /* 使っていた人の席が空き、受講の紐付けも外れる */
  const s1 = await db.from("seats").select("used_by, used_at").eq("code", codes[1]).maybeSingle();
  check(!s1.data?.used_by && !s1.data?.used_at, "戻した席は未使用になる");
  const e1 = await db.from("enrollments").select("seat_id").eq("id", E2).maybeSingle();
  check(!e1.data?.seat_id, "受講の紐付けも外れる");

  /* 記録は消さない。特別教育を行っているのはこの仕組みの運営なので、
     行った教育の記録は、こちら側に残っていなければならない */
  const closed = await db.from("enrollments").select("closed_at, seat_id").eq("id", E2).maybeSingle();
  check(!!closed.data?.closed_at, "取り消した受講は閉じる（消さない）");
  check(!closed.data?.seat_id, "席の紐付けは外れる");
  for (const t of ["progress", "exams", "training_attempts", "verify_logs"]) {
    const { data } = await db.from(t).select("id").eq("enrollment_id", E2);
    check((data ?? []).length > 0, `${t} の記録は残る（${(data ?? []).length} 件）`);
  }

  /* もう一度受けると、新しい受講が0から始まる */
  const fresh = await db.rpc("enrollment_for", { p_user: U2, p_course: "ashiba" });
  check(!fresh.error && fresh.data && fresh.data !== E2,
    `次に受けるときは新しい受講（${fresh.data}）`);
  const zero = await db.from("progress").select("id").eq("enrollment_id", fresh.data as string);
  check((zero.data ?? []).length === 0, "新しい受講は0から始まる");
  const both = await db.from("enrollments").select("id").eq("user_id", U2).eq("course_id", "ashiba");
  check((both.data ?? []).length === 2, "閉じた受講と、新しい受講の2件が残る");
  /* 修了証の控えも残す。出した書類の記録なので消してはいけない */
  const kept = await db.from("certificates").select("id, revoked_at").eq("enrollment_id", E2);
  check((kept.data ?? []).length > 0, "取り消した修了証の控えは残る");
  check((kept.data ?? []).every((c) => c.revoked_at), "残っているのは取り消し済みのものだけ");

  /* よその人の記録は消さない */
  const elses = await db.from("progress").select("id").eq("enrollment_id", E3);
  check((elses.data ?? []).length > 0, `他人の学科の記録は消さない（${(elses.data ?? []).length} 件）`);

  /* 戻した席は、もう一度配れる */
  const { error } = await db.rpc("redeem_seat", { p_code: codes[1], p_user: U2 });
  check(!error, `戻した受講コードは、もう一度使える（${error?.message ?? "ok"}）`);

  /* 4桁区切りで入れても通る（画面に出しているのはその形） */
  await raw.query("update public.companies set trial = false where id = $1", [CO]);
  const dashed = await releaseSeat(db, `${codes[1].slice(0, 4)}-${codes[1].slice(4, 8)}-${codes[1].slice(8)}`, CO);
  check(dashed.ok, `区切りを入れたコードでも戻せる（${JSON.stringify(dashed)}）`);
  const gone = await learnFor(db, U2);
  check(!gone.ok, "席を戻された人は、もう受講できない");
  await raw.query("update public.companies set trial = true where id = $1", [CO]);
}

/* ⑧ 受講中の照合の記録。理由に「別人」を足した（0010） */
{
  const en = await db.from("verify_logs").insert({
    enrollment_id: E2, lesson_id: "ashiba:1-1", result: "ng", reason: "not_me",
  }).select("id");
  check(!en.error, `別人として記録できる（${en.error?.message ?? "ok"}）`);

  const bad = await db.from("verify_logs").insert({
    enrollment_id: E2, lesson_id: "ashiba:1-1", result: "ng", reason: "nonsense",
  });
  check(!!bad.error, "知らない理由は入らない");

  const okRow = await db.from("verify_logs").insert({
    enrollment_id: E2, lesson_id: "ashiba:1-1", result: "ok", reason: null,
  }).select("id");
  check(!okRow.error, "通ったときは理由なしで入る");

  const bothNull = await db.from("verify_logs").insert({
    enrollment_id: E2, lesson_id: "ashiba:1-1", result: "ng", reason: null,
  });
  check(!!bothNull.error, "止まったのに理由が無い行は入らない");
}

/* ⑨ 照合の記録の画面（/api/admin/verify と同じ問い合わせ）。
   これが「本人が受けた証拠」。監督署に聞かれたとき事業者が出すもの */
{
  await raw.query("delete from public.verify_logs");
  await raw.query(
    `insert into public.verify_logs (enrollment_id, lesson_id, result, reason, created_at) values
       ($1,'ashiba:1-1','ok',null, now() - interval '2 hours'),
       ($1,'ashiba:1-1','ok',null, now() - interval '1 hour'),
       ($1,'ashiba:1-2','ng','not_me', now() - interval '30 minutes'),
       ($2,'ashiba:1-1','ng','blocked', now() - interval '10 minutes'),
       ($1,'ashiba:1-2','ng','no_face', now() - interval '400 days')`,
    [E2, E3],
  );

  /* 直近90日ぶんだけ読む（古い1件は落ちる） */
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const logs = await must(
    "照合の記録を期間で絞って引ける",
    db.from("verify_logs")
      .select("enrollment_id, lesson_id, result, reason, created_at")
      .in("enrollment_id", [E2, E3])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
  );
  check((logs ?? []).length === 4, `90日より古い記録は出ない（いま ${(logs ?? []).length} 件）`);

  const people = await must("自社の受講者", db.from("users").select("id, name, email").eq("company_id", CO));
  const ens = await must("受講", db.from("enrollments").select("id, user_id").in("user_id", (people ?? []).map((u) => u.id as string)));

  const rows = buildCheck({
    users: (people ?? []) as never,
    enrollments: (ens ?? []) as never,
    logs: (logs ?? []) as never,
  });
  const suzukiCheck = rows.find((r) => r.name === "鈴木")!;
  const tanakaCheck = rows.find((r) => r.name === "田中")!;
  check(suzukiCheck.ok === 2 && suzukiCheck.ng === 1, `鈴木は通った2回・止まった1回（${suzukiCheck.ok}/${suzukiCheck.ng}）`);
  check(suzukiCheck.reasons[0].reason === "not_me", "鈴木が止まった理由は別人");
  check(tanakaCheck.ng === 1 && tanakaCheck.reasons[0].reason === "blocked", "田中はカメラを遮られて止まった");
  check(rows[0].ng >= rows[rows.length - 1].ng, "止まった人が上に来る");
  check(checkTotals(rows).stopped === 2, "止まった人は2人");
}

await raw.end();

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
