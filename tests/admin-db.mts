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
import { KEEP_YEARS, erasable, keepUntil } from "@/lib/retention";
import { isFreeChapter, trainFor } from "@/lib/trainingGate";
import { buildCheck, checkTotals } from "@/training/verifyLog";
import { maySeeInvoice, unpaidInvoices } from "@/lib/invoiceAccess";
import { myLive, openSessions, doneOf, minOf, talkDone, inWindow } from "@/lib/liveQuery";
import { TALK_MIN, TALK_SUBJECT } from "@/content/shokucho";

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

/* ── 通し見学（0019）──
   点は付かないが「手順を最後まで見たか」は担当者が知りたい。
   開いたときに done=false、最後まで見たときに done=true で呼ぶ */
{
  const see = (chapter: string, done: boolean) =>
    db.rpc("see_demo", { p_enrollment: E2, p_chapter: chapter, p_done: done });

  await must("見学を開いたことを残せる", see("ch1", false));
  await must("見終えたことを残せる", see("ch1", true));

  const one = async () => {
    const { data } = await db
      .from("training_views")
      .select("enrollment_id, chapter, times, done")
      .eq("enrollment_id", E2)
      .eq("chapter", "ch1")
      .maybeSingle();
    return data as { times: number; done: boolean } | null;
  };

  const v1 = await one();
  check(v1?.times === 1, `開いて最後まで見ても、回数は1（いま ${v1?.times}）`);
  check(v1?.done === true, "最後まで見たことが残る");

  /* もう一度開くと回数だけ増える。見終えた印は下がらない */
  await must("もう一度開ける", see("ch1", false));
  const v2 = await one();
  check(v2?.times === 2, `開き直すと回数が増える（いま ${v2?.times}）`);
  check(v2?.done === true, "一度見終えていれば、開き直しても下がらない");

  /* 章ごとに分かれている */
  await must("別の章も残せる", see("ch2", false));
  const { data: all } = await db
    .from("training_views")
    .select("chapter")
    .eq("enrollment_id", E2);
  check((all ?? []).length === 2, `章ごとに1行（いま ${(all ?? []).length}）`);

  /* 知らない章は入らない */
  const { error: ng } = await see("ch9", false);
  check(!!ng, "知らない章は、見学でもデータベースが拒む");
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
const views = await must("通し見学を引ける", db.from("training_views").select("enrollment_id, chapter, times, done").in("enrollment_id", eids));
const certs0 = await must("修了証を引ける", db.from("certificates").select("enrollment_id, cert_no, issued_at, revoked_at").in("enrollment_id", eids));
check((certs0 ?? []).length === 0, "まだ修了証は出ていない");

const rows = buildRoster({
  users: (users ?? []) as never,
  enrollments: (enrollments ?? []) as never,
  progress: (progress ?? []) as never,
  exams: (exams ?? []) as never,
  attempts: (attempts ?? []) as never,
  views: (views ?? []) as never,
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

/* ── 討議の回（0022）──

   職長教育は討議方式が原則。開いただけでは修了にしない。
   誰が・いつ入って・いつ出て・実際に何分居たかを、データベース側で残す。
   画面から「何分居た」を送らせない（送らせると、繋がずに修了できる）。

   討議は講座に1回だけ、45分。科目ごとに置くと、科目の数だけ
   日を合わせて集まることになり、受ける人にも講師にも重すぎる。
   その45分は12時間の中に入り、科目3の時間として数える。
   つなぎ先は Zoom で、URL は回ごとに登録する。 */
{
  const S1 = "dddddddd-1111-1111-1111-111111111111";
  await must(
    "討議の回を立てられる",
    db.from("live_sessions").insert({
      id: S1, course_id: "shokucho", subject_id: TALK_SUBJECT, company_id: CO,
      starts_at: "2026-09-10T09:00:00Z", minutes: TALK_MIN, capacity: 15, teacher: U1,
      room_url: "https://us06web.zoom.us/j/00000000000",
    }).select("id"),
  );

  /* 1回15人まで。多いと討議にならない */
  {
    const { error } = await db.from("live_sessions").insert({
      course_id: "shokucho", subject_id: 1,
      starts_at: "2026-09-11T09:00:00Z", minutes: 60, capacity: 20,
    });
    check(!!error, "16人以上の回は、データベースが拒む");
  }

  /* 申し込み → 入る → 出る → 入り直す */
  await must("申し込める", db.rpc("book_live", { p_session: S1, p_user: U2 }));
  await must("入れる", db.rpc("live_in", { p_session: S1, p_user: U2 }));
  await must("二度押しても平気", db.rpc("live_in", { p_session: S1, p_user: U2 }));
  await must("出られる", db.rpc("live_out", { p_session: S1, p_user: U2 }));
  await must("入り直せる", db.rpc("live_in", { p_session: S1, p_user: U2 }));

  const mine = await myLive(db as never, U2);
  const m = mine.get(S1)!;
  check(!!m, "出た記録が引ける");
  check(m.spans.length === 2, `入退室は2組（いま ${m.spans.length}）`);
  check(!!m.spans[0].out, "1組目は閉じている");
  check(m.spans[1].out === null, "2組目は開いたまま");

  /* 申し込んでいない人は入れない */
  {
    const { error } = await db.rpc("live_in", { p_session: S1, p_user: ORPHAN });
    check(!!error, "申し込んでいなければ入れない");
  }

  /* 開いただけでは修了にしない。時間・回答・講師の確認が要る */
  const now = new Date(new Date(m.spans[1].in).getTime() + (TALK_MIN + 1) * 60 * 1000);
  check(!doneOf(m, TALK_MIN, now).ok, "課題に答えていなければ未修了");
  await must("課題に答える", db.from("live_attend").update({ answer: "配置案：…" })
    .eq("session_id", S1).eq("user_id", U2).select("session_id"));
  const m2 = (await myLive(db as never, U2)).get(S1)!;
  const d2 = doneOf(m2, TALK_MIN, now);
  check(!d2.ok && d2.why === "teacher", "講師の確認が無ければ未修了");
  await must("講師が確認する", db.from("live_attend").update({ teacher_ok: true })
    .eq("session_id", S1).eq("user_id", U2).select("session_id"));
  const m3 = (await myLive(db as never, U2)).get(S1)!;
  check(doneOf(m3, TALK_MIN, now).ok, "3つそろえば修了");
  check(minOf(m3, now) >= TALK_MIN, `居た時間が数えられる（${minOf(m3, now)}分）`);

  /* よその会社の回は出さない */
  const seen = await openSessions(db as never, "shokucho", CO, new Date("2026-01-01"));
  check(seen.some((x) => x.id === S1), "自分の会社の回は出る");
  const other = await openSessions(db as never, "shokucho", "00000000-0000-0000-0000-000000000009", new Date("2026-01-01"));
  check(!other.some((x) => x.id === S1), "よその会社の回は出さない");
  check(seen.find((x) => x.id === S1)?.booked === 1, "申し込んだ人数が出る");

  /* 討議は講座に1回。どれか1つ通っていれば、この講座の討議は済み */
  const after = await myLive(db as never, U2);
  check(talkDone(seen, after, now).ok, "討議は講座に1回、通っていれば済み");
  check(talkDone(seen, after, now).sessionId === S1, "どの回で済んだか分かる");
  check(!talkDone(seen, new Map(), now).ok, "申し込んでいなければ済みにしない");

  /* つなぎ先（Zoom）は、始まる前や終わったあとには渡さない */
  const ss = seen.find((x) => x.id === S1)!;
  check(!!ss.roomUrl, "回に Zoom の URL を持たせられる");
  check(!inWindow(ss.startsAt, ss.minutes, new Date("2026-09-09T09:00:00Z")), "前の日には渡さない");
  check(inWindow(ss.startsAt, ss.minutes, new Date("2026-09-10T08:50:00Z")), "始まる少し前からは渡す");
  check(!inWindow(ss.startsAt, ss.minutes, new Date("2026-09-10T11:00:00Z")), "終わって時間が経てば渡さない");

  await db.from("live_sessions").delete().eq("id", S1);
}

/* ── 会社を移ったら、教育担当者ではなくなる（0021）──

   参加コードは一般の社員に配るもの。自分の事業者を作って担当者に
   なった人が、よその会社の参加コードを入れただけで、その会社の
   担当者になれてしまっていた。名簿も修了証の発行も、その会社名義の
   発注も、請求書まで見られる形だった */
{
  const roleOf = async (u: string) => {
    const { data } = await db.from("users").select("role, company_id").eq("id", u).maybeSingle();
    return data as { role: string; company_id: string | null } | null;
  };

  /* U2 をいったん担当者に仕立てる（自分の会社を作った人と同じ状態） */
  await must("担当者にする", db.from("users").update({ role: "admin" }).eq("id", U2).select("id"));
  const before = await roleOf(U2);
  check(before?.role === "admin", "担当者になっている");

  /* よその会社へ移る */
  const { data: other } = await db
    .from("companies")
    .insert({ name: "移り先の会社", join_code: "ZZZZ9999", created_by: U1 })
    .select("id")
    .single();
  await must("よその会社へ入る", db.rpc("join_company", { p_user: U2, p_company: other!.id }));
  const after = await roleOf(U2);
  check(after?.company_id === other!.id, "所属は移る");
  check(after?.role !== "admin", `移った先では担当者ではない（いま ${after?.role}）`);

  /* 同じ会社に入り直しただけなら、担当を外さない
     （担当者が自分の受講コードを引き換えただけで外れると困る） */
  await must("担当者に戻す", db.from("users").update({ role: "admin" }).eq("id", U2).select("id"));
  await must("同じ会社に入り直す", db.rpc("join_company", { p_user: U2, p_company: other!.id }));
  check((await roleOf(U2))?.role === "admin", "同じ会社なら担当者のまま");

  /* 抜けたら降ろす。残すと、次にどこかへ入った瞬間に担当者に戻る */
  await must("会社を抜ける", db.rpc("leave_company", { p_user: U2, p_company: other!.id }));
  const gone = await roleOf(U2);
  check(gone?.company_id === null, "抜けたら所属は空");
  check(gone?.role !== "admin", "抜けたら担当者ではない");

  /* 後始末。ほかの試験に影響させない */
  await db.from("companies").delete().eq("id", other!.id);
  await db.rpc("join_company", { p_user: U2, p_company: CO });
}

/* ── 請求書を相手に見せる（0020）──
   よその会社の請求書には宛名も金額も載っている。
   注文の番号さえ分かれば開ける、という形にしてはいけない */
{
  const { data: o } = await db
    .from("orders")
    .select("id, company_id, user_id")
    .eq("id", orderId)
    .maybeSingle();
  const ord = { company_id: (o?.company_id as string) ?? null, user_id: (o?.user_id as string) ?? null };

  check(maySeeInvoice(ord, { owner: true }).ok, "本部は、どの請求書でも見られる");
  check(
    maySeeInvoice(ord, { owner: false, companyId: ord.company_id, userId: U1 }).ok,
    "その事業者の担当者は見られる",
  );
  check(
    !maySeeInvoice(ord, {
      owner: false,
      companyId: "00000000-0000-0000-0000-000000000009",
      userId: U1,
    }).ok,
    "よその事業者の担当者には見せない",
  );
  check(
    !maySeeInvoice(ord, { owner: false, companyId: null, userId: U1 }).ok,
    "どこにも属していない人には見せない",
  );
  /* 個人の注文は、申し込んだ本人だけ。会社の担当者でも見せない */
  const solo = { company_id: null, user_id: U2 };
  check(maySeeInvoice(solo, { owner: false, companyId: null, userId: U2 }).ok, "個人の注文は本人が見られる");
  check(
    !maySeeInvoice(solo, { owner: false, companyId: ord.company_id, userId: U1 }).ok,
    "よその人の個人の注文は、会社の担当者でも見せない",
  );

  /* 送ったことにする。何度押しても日時は動かない */
  await must("送ったことにできる", db.rpc("mark_invoiced", { p_order: orderId }));
  const at1 = await db.from("orders").select("invoiced_at").eq("id", orderId).maybeSingle();
  await must("もう一度押せる", db.rpc("mark_invoiced", { p_order: orderId }));
  const at2 = await db.from("orders").select("invoiced_at").eq("id", orderId).maybeSingle();
  check(!!at1.data?.invoiced_at, "送った日時が入る");
  check(at1.data?.invoiced_at === at2.data?.invoiced_at, "送り直しても、はじめの日時のまま");

  /* 届いている請求書は「送ってあって、まだ払っていない」もの */
  const bills = await unpaidInvoices(db as never, { userId: U1, companyId: ord.company_id });
  check(bills.some((b) => b.id === orderId), `届いている請求書に出る（${bills.length}件）`);
}


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

/* ②'' 受講コードを引き換えた人だけが、学科（特別教育）を開ける。
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
  /* ここは前まで「控えだけでも通す（受け皿）」にしていた。**それが穴だった。**
     事業者が1社しかないと、新しく登録した人に自動でその会社の
     company_id が入る（0007 handle_new_user）。在籍は立たない。
     控えで通していたので、まったく知らない人が登録しただけで、
     無償利用の会社の教材が全部開いていた。

     「紐付けされたユーザーは全て無料」の紐付けとは、許可の下りた在籍のこと。
     控えだけの人は通さない。会社に許可してもらう。 */
  check(
    !broken.ok,
    `在籍が無ければ、控えだけでは通さない（${JSON.stringify(broken)}）`,
  );
  check(broken.ok === false && broken.company !== "", "所属の名前は出す（誰に許可を頼めばよいか分かるように）");

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

  /* ── 誰が教育担当者か、元帳に出る ──
     担当者が1人も居なくなった会社は、本部からしか戻せない。
     そのとき「いま誰が担当者か」が見えないと、戻しようがない */
  const admins = led.people.filter((p) => p.admin);
  check(admins.length >= 1, `担当者が元帳に出る（いま ${admins.length}人）`);
  check(admins.every((p) => p.state === "在籍"), "担当者は在籍の人");

  /* よその会社の担当者を拾わないか。
     role だけ見ると、他社の担当者までこの会社の担当者に見えてしまう */
  {
    const OTHER = "cccccccc-9999-9999-9999-999999999999";
    await raw.query(
      "insert into public.companies (id, name, join_code, created_by) values ($1,$2,$3,$4) on conflict do nothing",
      [OTHER, "よその会社", "ZZZZ9999", U1],
    );
    /* U1 をよその会社の担当者にしてしまう */
    await raw.query("update public.users set role='admin', company_id=$1 where id=$2", [OTHER, U1]);
    const led2 = await companyRecords(db, CO);
    check(
      !led2.people.some((p) => p.userId === U1 && p.admin),
      "よその会社の担当者を、この会社の担当者として出さない",
    );
    /* 戻す */
    await raw.query("update public.users set role='admin', company_id=$1 where id=$2", [CO, U1]);
    await raw.query("delete from public.companies where id=$1", [OTHER]);
  }

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

  const r1 = await add(U2, "OT-001", { issuer: "前の会社", got: "2024-05-01", cert: "A-1" });
  check(!r1.error, `一覧にある資格を足せる（${r1.error?.message ?? "ok"}）`);

  const mine = await heldFor(db, U2);
  check(mine.length === 1, `1件入る（いま ${mine.length}件）`);
  check(mine[0].name.includes("職長"), `名前は一覧から出す（${mine[0].name}）`);
  check(mine[0].kind === "その他", `種類も出る（${mine[0].kind}）`);
  check(mine[0].issuer === "前の会社", "どこで受けたかが残る");
  check(mine[0].confirmedAt === null, "足しただけでは自己申告のまま");

  /* 同じものを足しても増えない。書き足しになる */
  const r2 = await add(U2, "OT-001", { issuer: "別の教習所", got: "2024-06-01" });
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
  const sling = held.find((h) => h.name.includes("職長"))!;
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
  await add(U2, "OT-001", { issuer: "書き換えた", got: "2024-07-01" });
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
  await add(U3, "SE-065", { issuer: "教習所" });
  const many = await heldForMany(db, [U2, U3, ORPHAN]);
  check(many.get(U2)?.length === 1, `まとめて引ける・U2（${many.get(U2)?.length}）`);
  check(many.get(U3)?.length === 1, `まとめて引ける・U3（${many.get(U3)?.length}）`);
  check(!many.has(ORPHAN), "持っていない人は入らない");
  check(
    (await heldForMany(db, [])).size === 0,
    "誰も居なければ引きに行かない",
  );

  /* ── まとめて足す（複数選択）──
     同じ教習機関で同じ日に何枚も取る。1つずつ足させると入れてもらえない */
  await raw.query("delete from public.held_quals where user_id = any($1::uuid[])", [PEOPLE]);
  {
    const many = ["SE-065", "SE-064", "OT-001"];
    for (const q of many) {
      const r = await add(U2, q, { issuer: "宮城労働基準協会", got: "2024-03-11" });
      if (r.error) { ng++; console.error("NG: まとめて足す", r.error.message); }
    }
    const got = await heldFor(db, U2);
    check(got.length === 3, `選んだぶんだけ入る（いま ${got.length}件）`);
    check(
      got.every((h) => h.issuer === "宮城労働基準協会" && h.gotOn === "2024-03-11"),
      `受けた所と日付は、選んだものすべてに入る（${got.map((h) => h.gotOn).join(" ")}）`,
    );
    check(
      got.every((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.gotOn ?? "")),
      "取った日は年月日だけ（時刻は持たない）",
    );
    check(
      got.every((h) => !h.confirmedAt),
      "まとめて足しても、確認済みにはならない",
    );

    /* 担当者の画面に出す「資格の申請」＝まだ確かめていないもの */
    const waiting = got.filter((h) => !h.confirmedAt);
    check(waiting.length === 3, `申請は3件（いま ${waiting.length}件）`);
    await db.rpc("confirm_qual", { p_id: got[0].id, p_company: CO, p_admin: U1, p_on: true });
    const after = (await heldFor(db, U2)).filter((h) => !h.confirmedAt);
    check(after.length === 2, `確かめたぶんは申請から消える（いま ${after.length}件）`);
  }

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

/* ── 3年たった記録（安衛則 第38条）──
   特別教育を行ったときは、受講者・科目等の記録を3年間保存する決まり。
   過ぎたぶんの個人情報は、置いておかないのが筋。
   ただし、決まりの記録を早く消してしまっては本末転倒 */
console.log("── 3年たった記録 ──");
{
  /* 見るのは「いま」ではなく、差し込んだ日で見る（試験が年を越しても同じ結果） */
  const soon = new Date("2027-01-01T00:00:00Z");
  const late = new Date("2031-01-01T00:00:00Z");

  check(KEEP_YEARS === 3, `保存は3年（いま ${KEEP_YEARS}年）`);
  check(keepUntil("2026-08-26") === "2029-08-26", `3年後が出る（${keepUntil("2026-08-26")}）`);

  /* U2・U3 はこの会社に在籍していて、受講の記録もある */
  const now1 = await erasable(db, soon);
  check(!now1.some((r) => r.userId === U2), "3年たっていない人は出ない");

  /* 3年たっても、在籍しているうちは出さない（まだ働いている人） */
  const old2 = await erasable(db, late);
  check(!old2.some((r) => r.userId === U2), "在籍しているうちは、3年たっても出ない");

  /* 抜けたら出る */
  await db.rpc("leave_company", { p_user: U2, p_company: CO });
  const gone = await erasable(db, late);
  const me = gone.find((r) => r.userId === U2);
  check(!!me, "抜けていて、3年たっていれば出る");
  check((me?.records ?? 0) >= 1, `受講の件数が出る（${me?.records}）`);
  check(!!me?.until, `保存期間の切れる日が出る（${me?.until}）`);

  /* 1件でも新しい受講が残っていたら、消さない。
     よその会社でまだ1年目、ということがある */
  /* 2031年から見て3年以内（＝まだ保存期間の中）にする */
  await raw.query(
    "update public.enrollments set completed_at = '2030-06-01' where id = $1", [E2],
  );
  const fresh = await erasable(db, late);
  check(
    !fresh.some((r) => r.userId === U2),
    "1件でも新しい受講が残っていたら、消さない",
  );
  await raw.query(
    "update public.enrollments set completed_at = '2020-01-01' where id = $1", [E2],
  );

  /* ── 消す ── */
  const before = await erasable(db, late);
  check(before.some((r) => r.userId === U2), "もう一度、消せる形に戻った");

  /* 在籍している人は、押しても止まる（押し間違いの受け皿） */
  const stop = await db.rpc("erase_learner", { p_user: U1 });
  check(!!stop.error, "在籍している人は、押しても消せない");

  const gotName = (await raw.query("select name from public.users where id = $1", [U2])).rows[0].name;
  check(gotName !== "（削除済み）", `消す前は名前がある（${gotName}）`);

  const r = await db.rpc("erase_learner", { p_user: U2 });
  check(!r.error && r.data === true, `消せる（${r.error?.message ?? "ok"}）`);

  const after = (await raw.query(
    "select name, email, birth_date, erased_at from public.users where id = $1", [U2],
  )).rows[0];
  check(after.name === "（削除済み）", `氏名が消える（${after.name}）`);
  check(after.email === null, "メールが消える");
  check(after.birth_date === null, "生年月日が消える");
  check(!!after.erased_at, "いつ消したかが残る");

  /* 受講の記録と修了証は残す。番号で照会されるため */
  const keptEn = (await raw.query(
    "select count(*)::int as n from public.enrollments where user_id = $1", [U2],
  )).rows[0].n;
  check(keptEn >= 1, `受講の記録は残る（${keptEn}件）`);
  const keptProg = (await raw.query(
    "select count(*)::int as n from public.progress where enrollment_id = $1", [E2],
  )).rows[0].n;
  check(keptProg >= 1, `視聴記録も残る（${keptProg}件）`);

  /* 顔の照合の記録と、自己申告の資格は消す */
  const logs = (await raw.query(
    "select count(*)::int as n from public.verify_logs where enrollment_id = $1", [E2],
  )).rows[0].n;
  check(logs === 0, `顔の照合の記録は消える（${logs}件）`);
  const quals = (await raw.query(
    "select count(*)::int as n from public.held_quals where user_id = $1", [U2],
  )).rows[0].n;
  check(quals === 0, `自己申告の資格も消える（${quals}件）`);

  /* 消したあとは、もう出ない（二重に数えない） */
  const twice = await erasable(db, late);
  check(!twice.some((r) => r.userId === U2), "消したあとは、もう出ない");

  /* 戻す。あとの試験がこの人を使う */
  await raw.query(
    "update public.users set name = '鈴木', erased_at = null where id = $1", [U2],
  );
  await db.rpc("join_company", { p_user: U2, p_company: CO });
}


/* ── 実務トレーニングの利用権 ──
   第1章は誰でも遊べる（試し）。第2章から先は利用権を持っている人だけ。
   特別教育（学科）とは別の売り物。席とは分けてある */
console.log("── 実務トレーニングの利用権 ──");
{
  check(isFreeChapter("ch1"), "第1章は誰でも");
  check(!isFreeChapter("ch2"), "第2章は誰でもではない");
  check(!isFreeChapter("ch3"), "第3章も同じ");

  await raw.query("delete from public.training_access where user_id = any($1::uuid[])", [PEOPLE]);
  await raw.query("update public.companies set trial = false where id = $1", [CO]);

  /* 学科の受講コードを持っていても、実務は開かない（別の売り物） */
  const seat = await trainFor(db, U3);
  check(!seat.ok && seat.why === "free", `受講コードだけでは開かない（${JSON.stringify(seat)}）`);

  /* 本部が付ける */
  const g = await db.rpc("grant_training", {
    p_user: U3, p_by: U1, p_source: "owner", p_note: "8/26 振込",
  });
  check(!g.error && g.data === true, `付けられる（${g.error?.message ?? "ok"}）`);
  const paid = await trainFor(db, U3);
  check(paid.ok && paid.by === "paid", `付ければ開く（${JSON.stringify(paid)}）`);

  /* 何度押しても増えない */
  await db.rpc("grant_training", { p_user: U3, p_by: U1, p_source: "owner", p_note: "押し直し" });
  const n = (await raw.query(
    "select count(*)::int as n from public.training_access where user_id = $1", [U3],
  )).rows[0].n;
  check(n === 1, `2回押しても1件（いま ${n}件）`);
  const note = (await raw.query(
    "select note from public.training_access where user_id = $1", [U3],
  )).rows[0].note;
  check(note === "押し直し", `覚え書きは新しい方（${note}）`);

  /* 居ない人には付かない */
  const bad = await db.rpc("grant_training", {
    p_user: "aaaaaaaa-0000-0000-0000-0000000000ff", p_by: U1, p_source: "owner", p_note: null,
  });
  check(bad.data === false, "居ない人には付かない");

  /* 取り消す。遊んだ記録は消さない */
  const before = (await raw.query(
    "select count(*)::int as n from public.training_attempts where enrollment_id = $1", [E3],
  )).rows[0].n;
  await db.rpc("revoke_training", { p_user: U3 });
  const off = await trainFor(db, U3);
  check(!off.ok, "取り消すと開かなくなる");
  const after = (await raw.query(
    "select count(*)::int as n from public.training_attempts where enrollment_id = $1", [E3],
  )).rows[0].n;
  check(after === before, `遊んだ記録は残る（${before} → ${after}）`);

  /* 無償利用の事業者に在籍していれば、利用権が無くても開く */
  await raw.query("update public.companies set trial = true where id = $1", [CO]);
  const tri = await trainFor(db, U3);
  check(tri.ok && tri.by === "trial", `無償利用なら開く（${JSON.stringify(tri)}）`);

  /* 申し込んだだけの人は通さない。
     会社の名前は誰でも探せるので、申し込むだけで開くと意味が無い */
  await raw.query("delete from public.memberships where user_id = $1", [ORPHAN]);
  await raw.query("update public.users set company_id = null where id = $1", [ORPHAN]);
  await db.rpc("request_membership", { p_user: ORPHAN, p_company: CO });
  const asked = await trainFor(db, ORPHAN);
  check(!asked.ok, "無償利用の会社に申し込んだだけでは開かない");
  await db.rpc("join_company", { p_user: ORPHAN, p_company: CO });
  const joined = await trainFor(db, ORPHAN);
  check(joined.ok && joined.by === "trial", "許可が下りれば開く");

  await raw.query("update public.companies set trial = false where id = $1", [CO]);
  await raw.query("delete from public.training_access where user_id = any($1::uuid[])", [PEOPLE]);
}

/* ── 個人の注文（実務トレーニング）──
   教育担当者を通さずに、本人が買える。
   個人宛の請求書を出せないと、経費で落とす人が買えない */
console.log("── 個人の注文 ──");
{
  await raw.query("delete from public.training_access where user_id = any($1::uuid[])", [PEOPLE]);
  await raw.query("delete from public.orders where user_id = any($1::uuid[])", [PEOPLE]);

  /* 会社のものか個人のものか、どちらか片方 */
  const both = await raw.query(
    `insert into public.orders (company_id, user_id, kind, seats, unit_price, amount, method)
     values ($1, $2, 'training', 1, 3000, 3300, 'invoice')`,
    [CO, U2],
  ).catch((e) => e);
  check(both instanceof Error, "会社と個人の両方は付けられない");

  const none = await raw.query(
    `insert into public.orders (kind, seats, unit_price, amount, method)
     values ('training', 1, 3000, 3300, 'invoice')`,
  ).catch((e) => e);
  check(none instanceof Error, "どちらも無い注文は作れない");

  /* 受講コード（席）は会社しか買えない。
     修了証は事業者の名簿に紐づくので、個人に持たせない */
  const soloSeat = await raw.query(
    `insert into public.orders (user_id, kind, seats, unit_price, amount, method)
     values ($1, 'seat', 1, 3000, 3300, 'invoice')`,
    [U2],
  ).catch((e) => e);
  check(soloSeat instanceof Error, "個人は受講コードを買えない");

  /* 個人の実務トレーニングの注文は作れる */
  const made = await raw.query(
    `insert into public.orders (user_id, kind, seats, unit_price, amount, method, bill_to, bill_addr)
     values ($1, 'training', 1, 3000, 3300, 'invoice', '鈴木 太郎', '宮城県…')
     returning id`,
    [U2],
  );
  const oid = made.rows[0].id as string;
  check(!!oid, "個人の注文は作れる");

  /* 入金を確認すると、そのまま利用権が付く。
     2つに分けると「払ったのに開かない」が起きる */
  const before = await trainFor(db, U2);
  check(!before.ok, "払う前は開かない");

  const pay = await db.rpc("pay_solo_order", { p_order: oid, p_by: U1 });
  check(!pay.error && pay.data === true, `入金を立てられる（${pay.error?.message ?? "ok"}）`);

  const st = (await raw.query("select status, paid_at from public.orders where id = $1", [oid])).rows[0];
  check(st.status === "paid", `入金済みになる（${st.status}）`);
  check(!!st.paid_at, "入金日が入る");

  const after = await trainFor(db, U2);
  check(after.ok && after.by === "paid", `そのまま開く（${JSON.stringify(after)}）`);
  const src = (await raw.query(
    "select source, note from public.training_access where user_id = $1", [U2],
  )).rows[0];
  check(src.source === "order", `注文で付いたと分かる（${src.source}）`);
  check(`${src.note}`.includes(oid.slice(0, 8)), `どの注文かが残る（${src.note}）`);

  /* 会社の注文をこの道に流さない（席が配られなくなる） */
  const coOrder = await raw.query(
    `insert into public.orders (company_id, kind, seats, unit_price, amount, method)
     values ($1, 'seat', 1, 3000, 3300, 'invoice') returning id`,
    [CO],
  );
  const bad = await db.rpc("pay_solo_order", { p_order: coOrder.rows[0].id, p_by: U1 });
  check(!!bad.error, "会社の注文は、この道では立てられない");

  /* もう一度押しても、二重に付かない */
  await db.rpc("pay_solo_order", { p_order: oid, p_by: U1 });
  const n = (await raw.query(
    "select count(*)::int as n from public.training_access where user_id = $1", [U2],
  )).rows[0].n;
  check(n === 1, `2回押しても1件（いま ${n}件）`);

  await raw.query("delete from public.orders where user_id = any($1::uuid[])", [PEOPLE]);
  await raw.query("delete from public.orders where id = $1", [coOrder.rows[0].id]);
  await raw.query("delete from public.training_access where user_id = any($1::uuid[])", [PEOPLE]);
}

await raw.end();

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
