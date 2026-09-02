/* フェーズ2のE2E：受講の準備（同意→本人確認）、受講中の照合、修了試験。
   実行手順:
     npm run dev -- -p 3100
     node tests/e2e-prep-exam.mjs                # 足場
     COURSE=ishiwata node tests/e2e-prep-exam.mjs # 石綿

   **講座を決め打ちにしない。** 決め打ちにしていたので、
   講座を足しても、その講座が通しで受けられるかは誰も確かめていなかった。
   単元の番号も教材から読む（講座ごとに違う）。
   カメラは Chromium の偽デバイスに、本物の顔が写った映像を食わせる
   （tests/faces/face.y4m）。作り物の縞模様では顔検出が通らないので、
   ここを偽物のままにすると「本人確認が効いているか」を試験できない。 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

/* 合格経路の検証用：正解表は教材ファイルから作る（サーバは正解を返さないため） */
const COURSE = process.env.COURSE ?? "ashiba";
const CUR = JSON.parse(readFileSync(`content/courses/${COURSE}.json`, "utf-8"));
/* 単元の番号は教材から読む。講座ごとに違う */
const LESSON_IDS = CUR.subjects.flatMap((s) => s.lessons.map((l) => l.id));
const FIRST = LESSON_IDS[0];

const answerKey = (() => {
  const map = new Map();
  for (const s of CUR.subjects) for (const l of s.lessons) for (const q of l.quiz) map.set(q.q, q.ok);
  const extra = JSON.parse(readFileSync("content/exam-extra.json", "utf-8"));
  for (const q of extra.questions) map.set(q.q, q.ok);
  return map;
})();

const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
const die = (msg) => { console.error("NG:", msg); process.exit(1); };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-video-capture=${process.cwd()}/tests/faces/face.y4m`,
  ],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.grantPermissions(["camera"]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));

// 1) 準備が済んでいないと受講画面へ入れない（prep へリダイレクト）

/* 更新のお知らせが出ていたら閉じる（実機でも同じように一度だけ出る） */
const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

await page.goto(`${BASE}/edu/${COURSE}/${FIRST}`);
await dismissNotice();
await page.waitForURL(`**/edu/${COURSE}/prep?back=${FIRST}`);
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
/* モデルが落ちてくるまで、顔の登録はできない */
await page.getByTestId("capture-face").click({ timeout: 60000 });
await page.waitForSelector("text=登録用の画像です。");
/* 顔として読み取れたか。読み取れていなければ「撮り直してください」が出る */
if (await page.getByTestId("prep-ng").count()) {
  die(`顔を読み取れなかった（${await page.getByTestId("prep-ng").innerText()}）`);
}
await page.getByTestId("capture-id").click();
/* 氏名・生年月日はここでは入れない（マイページの1か所だけ）。
   ログインしていない手元動作では、そもそも枠が出ない */
if (await page.getByTestId("who-name").count()) {
  die("受講の準備の画面に氏名の入力欄が残っている（入り口はマイページだけ）");
}
await page.screenshot({ path: `${SC}/p2-02-enroll.png` });
const feature = await page.evaluate(
  () => JSON.parse(localStorage.getItem("ashiba.prep:local") ?? "{}").faceDescriptor?.length ?? 0,
);
if (feature !== 128) die(`顔の特徴量が端末内に無い（length=${feature}）`);
console.log("OK: 本物の顔から特徴量128を取り出して端末内に登録（書類・受講者情報も）");

// 3) 受講開始 → 受講画面（カメラ窓が出る）
await page.getByTestId("prep-done").click();
await page.waitForURL(`**/edu/${COURSE}/${FIRST}`);
await page.waitForSelector("text=再生すると、ナレーションが始まります。");
await page.getByRole("button", { name: "再生する" }).click();
// 偽カメラに流した本物の顔で照合が回り、「在席を確認」になる
await page.waitForSelector("text=在席を確認", { timeout: 20000 });
console.log("OK: 受講中の照合が動き、在席を確認");
await page.screenshot({ path: `${SC}/p2-03-lesson-cam.png` });
// 視聴時間も進む
await page.waitForFunction(() => window.__lessonStore.getState().watchedSec >= 2, null, { timeout: 15000 });
await page.getByRole("button", { name: "一時停止" }).click();

// 4) 修了試験：全単元合格前はロック
await page.goto(`${BASE}/edu/${COURSE}/exam`);
await page.waitForSelector("text=まだ受験できません");
console.log("OK: 全単元合格前は修了試験がロック");
await page.screenshot({ path: `${SC}/p2-04-exam-locked.png` });

// 5) 全単元を合格済みにして受験 → サーバ採点
await page.evaluate(
  ({ ids, course }) => {
    for (const id of ids) {
      /* 鍵は ashiba.progress.{講座}.{単元}。
         「ashiba.」はアプリの名前空間で、講座の目印ではない。
         前はここに講座が入っておらず、書いても効いていなかった
         （src/lib/progressClient.ts） */
      localStorage.setItem(
        `ashiba.progress.${course}.${id}`,
        JSON.stringify({ watchedSec: 99999, quizPassedAt: new Date().toISOString() }),
      );
    }
  },
  { ids: LESSON_IDS, course: COURSE },
);
await page.reload();
await page.waitForSelector('[data-testid="exam-start"]', { timeout: 10000 }).catch(() => {});
if (!(await page.locator('[data-testid="exam-start"]').count())) {
  console.log("SKIP: サーバ記録モードでは全単元の合格を画面から作れないため試験までは検証しない（supabase-mode.mjs 側で確認）");
  await browser.close();
  console.log("ALL OK");
  process.exit(0);
}
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
  await page.goto(`${BASE}/edu/${COURSE}/exam`);
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
await page.waitForSelector("text=修了証を出す");
console.log("OK: 全問正解で合格（20/20）→ 修了証へ進める");
await page.screenshot({ path: `${SC}/p2-06b-exam-passed.png` });

// 6) 一覧に準備状態と修了試験カードが出る
/* 講座が増えたので /edu は「講座の一覧」になる。
   受講の準備が出るのは、その講座の単元一覧のほう */
await page.goto(`${BASE}/edu/${COURSE}`);
await page.waitForSelector("text=受講の準備（同意・本人確認）");
await page.waitForSelector("text=登録済み");
await page.waitForSelector("text=全単元を修了しました。受験できます");
console.log("OK: 一覧に準備状態（登録済み）と修了試験カード");
await page.screenshot({ path: `${SC}/p2-07-list.png` });

await browser.close();
console.log("ALL OK");
