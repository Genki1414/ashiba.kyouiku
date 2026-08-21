/* 資材カタログと通し見学のE2E。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-catalog-demo.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => { console.error("pageerror:", e.message); ng++; });

/* ── 章選択：①→②→③ の導線 ── */
await page.goto(`${BASE}/training`);
await page.waitForSelector("text=実務トレーニング");
for (const t of ["① 資材カタログ", "② 通し見学", "③ チュートリアル"]) {
  check(await page.locator(`text=${t}`).count() > 0, `章選択に「${t}」がある`);
}
await page.screenshot({ path: `${SC}/cat-01-chapters.png` });

/* ── 資材カタログ：16点 ── */
await page.click("text=① 資材カタログ");
await page.waitForURL("**/training/catalog**");
await page.waitForSelector("text=資材カタログ");
const cards = await page.locator("main section button").count();
check(cards === 16, `カタログが16点ある（いま ${cards}）`);
const svgs = await page.locator("main section button svg").count();
check(svgs === 16, `16点すべてに絵がある（いま ${svgs}）`);
await page.screenshot({ path: `${SC}/cat-02-list.png` });

// 1点開く
await page.locator("main section button", { hasText: "ジャッキ" }).first().click();
await page.waitForSelector("text=何をするもの");
for (const t of ["何をするもの", "どこに付く", "現場での注意"]) {
  check(await page.locator(`text=${t}`).count() > 0, `説明に「${t}」がある`);
}
await page.screenshot({ path: `${SC}/cat-03-detail.png` });
await page.click("text=閉じる");

// 同じ資材である印（根がらみ手摺）
await page.locator("main section button", { hasText: "根がらみ手摺" }).first().click();
await page.waitForSelector("text=何をするもの");
check(
  (await page.locator("text=/呼び名は違っても、使う資材は同じ手摺/").count()) > 0,
  "根がらみ手摺に「同じ手摺資材」の断りが出る",
);
await page.screenshot({ path: `${SC}/cat-04-same.png` });
await page.click("text=閉じる");
console.log("OK: 資材カタログ");

/* ── 通し見学：15手すべてに「なぜ」 ── */
await page.goto(`${BASE}/training/demo`);
await page.waitForSelector("text=組立の通し見学");
for (let n = 1; n <= 15; n++) {
  const counter = await page.locator("main .font-mono").first().textContent();
  check(counter.includes(`${n}`), `${n}手目が出ている（表示: ${counter.trim()}）`);
  // 「なぜそうするのか」が必ずある
  const whyBtn = page.getByRole("button", { name: "なぜそうするのか" });
  check(await whyBtn.count() > 0, `${n}手目に「なぜそうするのか」がある`);
  await whyBtn.click();
  await page.waitForTimeout(80);
  const whyText = await page.locator("text=なぜそうするのか").locator("..").textContent();
  check(whyText.trim().length > 0, `${n}手目の理由が空でない`);
  if (n === 1) await page.screenshot({ path: `${SC}/cat-05-demo-1.png` });
  if (n === 4) await page.screenshot({ path: `${SC}/cat-06-demo-art.png` });
  if (n === 15) await page.screenshot({ path: `${SC}/cat-07-demo-last.png` });
  if (n < 15) {
    await page.getByRole("button", { name: "次の手 →" }).click();
    await page.waitForTimeout(90);
  }
}
check(await page.locator("text=第1章をやる").count() > 0, "最後に第1章への導線が出る");
console.log("OK: 通し見学 15手すべてに理由あり");

/* ── 章の中から資材を開ける ── */
await page.goto(`${BASE}/training/ch1`);
await page.waitForSelector("text=段取りと根がらみ");
await page.click("text=資材");
await page.waitForURL("**/training/catalog**");
await page.waitForSelector("text=資材カタログ");
await page.click("text=← 戻る");
await page.waitForURL("**/training/ch1**");
await page.waitForSelector("text=段取りと根がらみ");
console.log("OK: 章の中から資材を開いて戻れる");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
