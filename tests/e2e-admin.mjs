/* 教育担当者の画面と、事業者への参加のE2E。

   この仕組みは外販する（いくつもの会社が同じ画面を使う）ので、
   ・担当者でない人に中身が出ないか
   ・他社の操作ができないか
   を、画面の出し分けではなく API の断り方で見る。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-admin.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });
const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

/* ── 画面が開いて、状態を正しく言う ── */
await page.goto(`${BASE}/admin`);
await dismiss();
await page.waitForSelector("text=教育担当者", { timeout: 8000 });
const ngBox = page.getByTestId("admin-ng");
const setup = page.getByTestId("admin-setup");
const rows = page.getByTestId("admin-row");
const has = {
  ng: await ngBox.count(),
  setup: await setup.count(),
  list: await page.getByTestId("admin-totals").count(),
};
check(
  has.ng + has.setup + has.list === 1,
  `いつでも「使えない」「担当者を決める」「一覧」のどれか1つだけ出る（${JSON.stringify(has)}）`,
);
await page.screenshot({ path: `${SC}/admin-01.png` });

if (has.ng) {
  const t = (await ngBox.innerText()).trim();
  check(t.length > 5, `理由が書いてある（${t}）`);
  console.log("OK: Supabase 未設定のとき、理由を出して止まる");
} else if (has.setup) {
  console.log("OK: まだ事業者に属していないので、作る画面が出る");
} else {
  const n = await rows.count();
  console.log(`OK: 一覧が出る（受講者 ${n}人）`);
}

/* ── 中身は API で守る。画面の出し分けに頼らない ── */
for (const [url, body] of [
  ["/api/admin/summary", null],
  ["/api/admin/setup", { company: "勝手に作った会社" }],
  ["/api/admin/company", { name: "勝手に変えた社名" }],
  ["/api/join", { code: "ABCD2345" }],
  ["/api/admin/cert", { enrollmentId: "00000000-0000-0000-0000-000000000000", action: "issue" }],
  ["/api/admin/role", { userId: "00000000-0000-0000-0000-000000000000", admin: true }],
]) {
  const r = await page.evaluate(
    async ([u, b]) => {
      const res = await fetch(u, b
        ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }
        : {});
      return { status: res.status, body: await res.text() };
    },
    [url, body],
  );
  check(r.status !== 200 || !r.body.includes('"rows"'),
    `${url} は担当者でなければ中身を返さない（${r.status}）`);
  check(r.status === 401 || r.status === 403 || r.status === 503 || r.status === 409 || r.status === 400,
    `${url} は理由の分かる断り方をする（いま ${r.status}）`);
}
console.log("OK: 担当者でなければ API が中身を出さない");

/* ── 実務の成績はサーバへ送るが、送れなくても記録は残る ── */
const sent = await page.evaluate(async () => {
  const res = await fetch("/api/training", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chapter: "ch1", tutorial: false, skill: 90, score: 1200, sec: 300 }),
  });
  return { status: res.status, body: await res.json() };
});
check(sent.status === 200, `/api/training は応答する（${sent.status}）`);
check(
  sent.body.mode === "local" || sent.body.mode === "supabase",
  `どちらに書いたかを返す（${JSON.stringify(sent.body)}）`,
);
const badCh = await page.evaluate(async () => {
  const res = await fetch("/api/training", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chapter: "ch9", skill: 90 }),
  });
  return res.status;
});
check(badCh === 400 || sent.body.mode === "local", `知らない章は断る（${badCh}）`);
console.log("OK: 実務の成績の送り先");

/* ── 参加コードの画面 ── */
await page.goto(`${BASE}/join`);
await dismiss();
await page.waitForSelector('[data-testid="join-code"]', { timeout: 8000 });
const go = page.getByTestId("join-go");
check(await go.isDisabled(), "何も入れないうちは押せない");
await page.getByTestId("join-code").fill("ABCD234");
check(await go.isDisabled(), "7文字では押せない");
await page.getByTestId("join-code").fill("ABCD2340");
check(await go.isDisabled(), "使っていない字（0）が入っていれば押せない");
await page.getByTestId("join-code").fill("abcd2345");
check(!(await go.isDisabled()), "小文字8文字なら押せる");
await page.screenshot({ path: `${SC}/admin-02-join.png` });
await go.click();
/* 決まった時間で待つと、遅い端末で取りこぼす。出るまで待つ */
await page.getByTestId("join-note").waitFor({ timeout: 8000 }).catch(() => {});
const joinNote = await page.getByTestId("join-note").count();
check(joinNote === 1, "つながらない・見つからないときは理由を出す");

/* 会社をさがす道も出ている（コードを渡されていない人のため） */
check(await page.getByTestId("join-search").isVisible(), "会社をさがして申し込む道が出る");
console.log("OK: 参加コードの画面");

/* ── ホームに担当者の入口は、担当者にだけ出る ── */
await page.goto(BASE);
await dismiss();
await page.waitForSelector("text=実務トレーニング", { timeout: 8000 });
const homeAdmin = await page.getByTestId("home-admin").count();
check(homeAdmin === (has.list ? 1 : 0), `ホームの入口は担当者にだけ出る（${homeAdmin}）`);
console.log("OK: ホームの入口");

/* ── 照合の記録（本人が受けた証拠）──
   ここに Supabase が無いので、返事だけ差し替えて画面を見る。
   監督署に聞かれたときに事業者が出すものなので、
   誰が・いつ・なぜ止まったかが読める形になっているかを見る。 */
{
  const row = (name, ok, ng, reasons, rows) => ({
    userId: name, name, email: `${name}@x`, ok, ng, reasons,
    first: "2026-08-25T09:00:00Z", last: "2026-08-25T11:30:00Z", rows,
  });
  await page.route("**/api/admin/verify*", (r) => r.fulfill({ json: {
    ok: true, company: "点検用工業", days: 90, capped: false,
    rows: [
      row("田中", 12, 2,
        [{ reason: "not_me", label: "登録した人と違う", n: 1 },
         { reason: "blocked", label: "カメラが遮られている", n: 1 }],
        [{ at: "2026-08-25T11:30:00Z", lesson: "1-2", ok: false, why: "登録した人と違う" },
         { at: "2026-08-25T10:00:00Z", lesson: "1-1", ok: false, why: "カメラが遮られている" },
         { at: "2026-08-25T09:00:00Z", lesson: "1-1", ok: true, why: null }]),
      row("鈴木", 30, 0, [],
        [{ at: "2026-08-25T09:05:00Z", lesson: "1-1", ok: true, why: null }]),
    ],
    totals: { people: 2, ok: 42, ng: 2, stopped: 1 },
  }}));
  await page.goto(`${BASE}/admin/check`);
  await dismiss();
  await page.getByTestId("check").waitFor({ timeout: 8000 });
  check((await page.getByTestId("check-row").count()) === 2, "受講者ごとに並ぶ");
  const first = (await page.getByTestId("check-row").first().innerText()).replace(/\s+/g, "");
  check(/田中/.test(first) && /2回止まった/.test(first), `止まった人が上に来る（${first.slice(0, 40)}）`);
  check(/登録した人と違う/.test(first), "止まった理由が日本語で出る");
  const second = (await page.getByTestId("check-row").last().innerText()).replace(/\s+/g, "");
  check(/止まらず受講/.test(second), "一度も止まらなかった人は、その旨が出る");
  await page.getByTestId("check-detail").first().click();
  await page.waitForTimeout(200);
  check(/2026\/08\/2511:30/.test((await page.getByTestId("check-row").first().innerText()).replace(/\s+/g, "")),
    "明細に日時が出る");
  await page.screenshot({ path: `${SC}/admin-04-check.png`, fullPage: true });
  await page.unroute("**/api/admin/verify*");
  console.log("OK: 照合の記録");
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
