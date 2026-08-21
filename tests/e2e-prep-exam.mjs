/* フェーズ2のE2E：受講の準備（同意→本人確認）、受講中の照合、修了試験。
   実行手順:
     npm run dev -- -p 3100
     node tests/e2e-prep-exam.mjs
   カメラは Chromium のフェイクデバイスを使う。 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

/* 合格経路の検証用：正解表は教材ファイルから作る（サーバは正解を返さないため） */
const answerKey = (() => {
  const map = new Map();
  const cur = JSON.parse(readFileSync("content/curriculum.json", "utf-8"));
  for (const s of cur.subjects) for (const l of s.lessons) for (const q of l.quiz) map.set(q.q, q.ok);
  const extra = JSON.parse(readFileSync("content/exam-extra.json", "utf-8"));
  for (const q of extra.questions) map.set(q.q, q.ok);
  return map;
})();

const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
const die = (msg) => { console.error("NG:", msg); process.exit(1); };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.grantPermissions(["camera"]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));

// 1) 準備が済んでいないと受講画面へ入れない（prep へリダイレクト）
await page.goto(`${BASE}/edu/1-1`);
await page.waitForURL("**/edu/prep?back=1-1");
await page.waitForSelector("text=カメラの使用について");
console.log("OK: 準備前は受講画面に入れず、同意画面へ");
await page.screenshot({ path: `${SC}/p2-01-consent.png` });

// 2) 同意 → 本人確認
await page.click("text=上記に同意し、カメラの使用を許可します");
await page.getByTestId("consent-next").click();
await page.waitForSelector("text=本人確認");
await page.getByTestId("cam-start").click();
await page.waitForSelector("video", { timeout: 10000 });
await page.waitForTimeout(800);
await page.getByTestId("capture-face").click();
await page.waitForSelector("text=登録用の画像です。");
await page.getByTestId("capture-id").click();
await page.getByTestId("who-name").fill("試験 太郎");
await page.getByTestId("who-birth").fill("1990-04-01");
await page.screenshot({ path: `${SC}/p2-02-enroll.png` });
const feature = await page.evaluate(() => JSON.parse(localStorage.getItem("ashiba.prep")).faceFeature?.length ?? 0);
if (feature !== 1024) die(`顔特徴量が端末内に無い（length=${feature}）`);
console.log("OK: 顔写真→特徴量（端末内・1024次元）、書類、受講者情報を登録");

// 3) 受講開始 → 受講画面（カメラ窓が出る）
await page.getByTestId("prep-done").click();
await page.waitForURL("**/edu/1-1");
await page.waitForSelector("text=再生すると、ナレーションが始まります。");
await page.getByRole("button", { name: "再生する" }).click();
// フェイクカメラの映像で照合が回り、「本人を確認」になる
await page.waitForSelector("text=本人を確認", { timeout: 20000 });
console.log("OK: 受講中の照合（3秒間隔）が動き、本人を確認");
await page.screenshot({ path: `${SC}/p2-03-lesson-cam.png` });
// 視聴時間も進む
await page.waitForFunction(() => window.__lessonStore.getState().watchedSec >= 2, null, { timeout: 15000 });
await page.getByRole("button", { name: "一時停止" }).click();

// 4) 修了試験：全単元合格前はロック
await page.goto(`${BASE}/edu/exam`);
await page.waitForSelector("text=まだ受験できません");
console.log("OK: 全単元合格前は修了試験がロック");
await page.screenshot({ path: `${SC}/p2-04-exam-locked.png` });

// 5) 全単元を合格済みにして受験 → サーバ採点
await page.evaluate(() => {
  const ids = ["1-1","1-2","1-3","1-4","2-1","2-2","2-3","3-1","3-2","3-3","3-4","4-1","4-2"];
  for (const id of ids) {
    localStorage.setItem(`ashiba.progress.${id}`, JSON.stringify({ watchedSec: 99999, quizPassedAt: new Date().toISOString() }));
  }
});
await page.reload();
await page.getByTestId("exam-start").click();
await page.waitForSelector("[data-exam-opt]");
await page.screenshot({ path: `${SC}/p2-05-exam.png` });
for (let q = 0; q < 20; q++) {
  await page.waitForSelector("[data-exam-opt]");
  // 常に1番目を選ぶ（採点はサーバなので合否はどちらでもよい）
  await page.locator("[data-exam-opt]").first().click();
  await page.waitForTimeout(60);
  if (await page.locator("text=/^(合格|不合格)$/").count()) break;
}
await page.waitForSelector("text=/^(合格|不合格)$/", { timeout: 10000 });
const scoreText = await page.locator("text=/\\d+\\/20/").first().textContent();
const passed = (await page.locator("text=/^合格$/").count()) > 0;
console.log(`OK: 修了試験をサーバ採点（${scoreText?.trim()}${passed ? "・合格" : "・不合格"}）`);
if (!passed) {
  if (!(await page.locator("text=間違えた問題").count())) die("不合格なのに復習リストが出ない");
  console.log("OK: 不合格時は間違えた問題と正解を表示");
}
await page.screenshot({ path: `${SC}/p2-06-exam-result.png` });

// 5b) 正解して合格できることも確認（正解表は教材ファイル由来）
if (!passed) {
  await page.getByRole("button", { name: "もう一度受験する" }).click();
}
else {
  await page.goto(`${BASE}/edu/exam`);
  await page.getByTestId("exam-start").click();
}
for (let q = 0; q < 20; q++) {
  await page.waitForSelector("[data-exam-opt]");
  const qText = (await page.getByTestId("exam-q").textContent())?.trim();
  const ok = answerKey.get(qText);
  if (ok === undefined) die(`正解表に無い設問: ${qText}`);
  await page.locator("[data-exam-opt]").nth(ok).click();
  await page.waitForTimeout(60);
  if (await page.locator("text=/^(合格|不合格)$/").count()) break;
}
await page.waitForSelector("text=/^合格$/", { timeout: 10000 });
await page.waitForSelector("text=修了証の発行は、お申込みの入金確認後に行われます");
console.log("OK: 全問正解で合格（20/20）→ 修了証はフェーズ3の案内");
await page.screenshot({ path: `${SC}/p2-06b-exam-passed.png` });

// 6) 一覧に準備状態と修了試験カードが出る
await page.goto(`${BASE}/edu`);
await page.waitForSelector("text=受講の準備（同意・本人確認）");
await page.waitForSelector("text=登録済み");
await page.waitForSelector("text=全単元を修了しました。受験できます");
console.log("OK: 一覧に準備状態（登録済み）と修了試験カード");
await page.screenshot({ path: `${SC}/p2-07-list.png` });

await browser.close();
console.log("ALL OK");
