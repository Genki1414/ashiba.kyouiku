/* 受講画面のE2E（フェーズ1の完了条件：1単元が最後まで通ること）。
   実行手順:
     npm run dev -- -p 3100
     node tests/e2e-lesson.mjs
   Chromium の場所は PW_CHROMIUM で上書きできる。
   確認すること:
   - ホーム → 一覧（13単元・端末内記録の表示）
   - ナレーションが進む／再生中のみ加算／一時停止で止まる
   - 図解8枚（全部開く → 確認に正解）→ 災害事例2件 → 規定時間前のロック
   - 規定時間到達後、確認問題6問 → 修了 → 一覧に反映 */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
const shot = (p, n) => p.screenshot({ path: `${SC}/shot-${n}.png` });
const die = (msg) => { console.error("NG:", msg); process.exit(1); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("pageerror:", e.message));

// 1) ホーム → 一覧
await page.goto(BASE);
await page.waitForSelector("text=足場の教育アプリ");
await shot(page, "01-home");
await page.click("text=特別教育（学科）");
await page.waitForURL("**/edu");
await page.waitForSelector('a[href="/edu/1-1"]');
const cards = await page.locator('a[href^="/edu/"]').count();
if (cards !== 13) die(`一覧の単元数が ${cards}（13のはず）`);
await page.waitForSelector("text=端末内記録");
await shot(page, "02-list");

// 2) 受講画面：ナレーション
await page.click('a[href="/edu/1-1"]');
await page.waitForSelector("text=再生すると、ナレーションが始まります。");
await shot(page, "03-lesson-narr");
await page.getByRole("button", { name: "再生する" }).click();
await page.waitForSelector("text=足場の組立て等の業務に係る特別教育、科目一", { timeout: 10000 });
await page.waitForSelector("text=この科目は三時間あり", { timeout: 60000 });
console.log("OK: ナレーションが進む（字幕が次の行へ）");
await page.waitForFunction(() => window.__lessonStore.getState().watchedSec >= 3, null, { timeout: 20000 });
console.log("OK: 再生中は視聴時間が加算される");
await page.getByRole("button", { name: "一時停止" }).click();
await page.waitForTimeout(600);
const w1 = await page.evaluate(() => window.__lessonStore.getState().watchedSec);
await page.waitForTimeout(2600);
const w2 = await page.evaluate(() => window.__lessonStore.getState().watchedSec);
if (w2 !== w1) die(`一時停止中に加算された（${w1}→${w2}）`);
console.log("OK: 一時停止中は加算されない");

// 3) 最終行まで飛ばして図解へ（E2E用フック）
await page.evaluate(() => window.__lessonStore.getState().set({ line: 258, playing: false }));
await page.getByRole("button", { name: "図解へ進む" }).click();
await page.waitForSelector("text=図解 F1-1-1");
await shot(page, "04-figure-1");

// 4) 図解8枚（全部開く → task に正解 → 次へ）
for (let f = 1; f <= 8; f++) {
  await page.waitForSelector('[data-fig-item]');
  while (await page.locator('[data-fig-item="closed"]').count()) {
    await page.locator('[data-fig-item="closed"]').first().click();
    await page.waitForTimeout(40);
  }
  const next = page.getByTestId("fig-next");
  if (!(await next.isEnabled())) {
    const opts = page.locator("[data-task-opt]");
    const cnt = await opts.count();
    for (let i = 0; i < cnt && !(await next.isEnabled()); i++) {
      await opts.nth(i).click();
      await page.waitForTimeout(40);
    }
  }
  if (!(await next.isEnabled())) die(`図解${f}枚目で「次へ」が押せない`);
  if (f === 4) await shot(page, "05-figure-4");
  await next.click();
  await page.waitForTimeout(200);
}
await page.waitForSelector("text=災害事例 C1-1-1");
console.log("OK: 図解8枚を通過");
await shot(page, "06-case-1");

// 5) 災害事例2件
for (let c = 1; c <= 2; c++) {
  const more = page.locator("button", { hasText: "続きを読む" });
  while (await more.count()) {
    await more.click();
    await page.waitForTimeout(30);
  }
  await page.getByRole("button", { name: "原因を考える" }).click();
  const opts = page.locator("[data-case-opt]");
  const cnt = await opts.count();
  for (let i = 0; i < cnt; i++) {
    await opts.nth(i).click();
    await page.waitForTimeout(60);
    if (await page.locator("text=③ 災害発生原因").count()) break;
  }
  await page.waitForSelector("text=再発防止対策");
  if (c === 1) await shot(page, "07-case-done");
  await page.getByTestId("case-next").click();
  await page.waitForTimeout(250);
}
console.log("OK: 災害事例2件を通過");

// 6) 規定時間前はロック
await page.waitForSelector("text=確認問題はまだ受けられません");
console.log("OK: 規定時間前は確認問題がロックされる");
await shot(page, "08-locked");

// 7) 規定時間到達（端末内記録モード）→ 確認問題6問
await page.evaluate(() => window.__lessonStore.getState().set({ watchedSec: 3000 }));
await page.waitForSelector("[data-quiz-opt]");
await shot(page, "09-quiz");
for (let q = 0; q < 6; q++) {
  if (await page.locator("text=この単元は修了しました").count()) break;
  const opts = page.locator("[data-quiz-opt]");
  const cnt = await opts.count();
  let before = await page.locator("text=/確認問題 （\\d+\\/6）/").textContent();
  let advanced = false;
  for (let i = 0; i < cnt; i++) {
    await opts.nth(i).click();
    await page.waitForTimeout(80);
    // 最後の問題は合格記録の往復があるので少し待つ
    for (let w = 0; w < 30 && !(await page.locator("text=この単元は修了しました").count()); w++) {
      const now0 = await page.locator("text=/確認問題 （\\d+\\/6）/").textContent().catch(() => before);
      if (now0 !== before) break;
      await page.waitForTimeout(100);
    }
    if (await page.locator("text=この単元は修了しました").count()) { advanced = true; break; }
    const now = await page.locator("text=/確認問題 （\\d+\\/6）/").textContent().catch(() => before);
    if (now !== before) { advanced = true; break; }
  }
  if (!advanced) die(`確認問題${q + 1}問目で先に進めない`);
}
await page.waitForSelector("text=この単元は修了しました");
console.log("OK: 確認問題6問 全問正解 → 修了");
await shot(page, "10-passed");

// 8) 一覧へ戻ると修了表示（localStorage に残っている）
await page.goto(`${BASE}/edu`);
await page.waitForSelector("text=修了");
await shot(page, "11-list-done");
console.log("OK: 一覧に修了が反映（記録が残る）");

await browser.close();
console.log("ALL OK");
