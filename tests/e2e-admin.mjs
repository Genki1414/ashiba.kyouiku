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
await page.waitForTimeout(600);
const joinNote = await page.getByTestId("join-note").count();
check(joinNote === 1, "つながらない・見つからないときは理由を出す");
console.log("OK: 参加コードの画面");

/* ── ホームに担当者の入口は、担当者にだけ出る ── */
await page.goto(BASE);
await dismiss();
await page.waitForSelector("text=実務トレーニング", { timeout: 8000 });
const homeAdmin = await page.getByTestId("home-admin").count();
check(homeAdmin === (has.list ? 1 : 0), `ホームの入口は担当者にだけ出る（${homeAdmin}）`);
console.log("OK: ホームの入口");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
