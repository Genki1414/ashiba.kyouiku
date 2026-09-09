/* 更新のお知らせ（/updates）。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-updates.mjs

   ── 画面をふさぐ知らせは、やめた（げんきさん 2026-09-09）──
   前は新しい更新のたびに全画面で被さっていた。「確認したのにまだ表示される」と
   何度も言われ、閉じた印を端末に覚えさせる形では確実に消せなかった。
   いまは**押しに行く形**。ここで見るのは、その入口と中身が生きているか。

   ・どの画面でも、勝手に被さらない
   ・ホームから /updates へ行ける
   ・/updates に更新が並び、「追加」「修正」の札が付く */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

/* ── 勝手に被さらない ── */
for (const path of ["/", "/edu", "/me", "/login"]) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(700);
  check((await page.getByTestId("update-notice").count()) === 0, `${path} で被さらない`);
}
console.log("OK: どの画面でも、知らせが被さらない");

/* ── ホームからの入口 ── */
await page.goto(`${BASE}/`);
await page.waitForTimeout(500);
{
  const link = page.locator('a[href="/updates"]');
  check((await link.count()) >= 1, "ホームに入口がある");
  await link.first().click();
  await page.waitForURL("**/updates", { timeout: 8000 });
  console.log("OK: ホームから更新の一覧へ行ける");
}

/* ── 中身 ── */
{
  const t = (await page.locator("body").innerText()).replace(/\s/g, "");
  check(t.includes("更新のお知らせ"), "見出しが出る");
  const rows = await page.getByTestId("update-row").count();
  check(rows > 3, `一覧に中身が並ぶ（${rows}件）`);
  /* 札は「追加」「修正」（2026-09-09 に「足した／直した」から変えた）。
     本文の中の「足した」「直した」はふつうの日本語なので、札だけを見る */
  const kinds = [...new Set(await page.getByTestId("update-kind").allInnerTexts())].map((x) => x.trim());
  check(kinds.length > 0 && kinds.every((k) => k === "追加" || k === "修正"),
    `札は追加・修正だけ（${kinds.join("・")}）`);
  console.log("OK: 更新の一覧が読める");
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
