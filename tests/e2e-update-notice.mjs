/* 更新のお知らせのE2E。
   はじめて開いたとき出る／閉じたら次の更新まで出ない／
   新しい更新が来たらまた出る、を実際のブラウザで見る。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-update-notice.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

const notice = () => page.getByTestId("update-notice");
const seen = () => page.evaluate(() => window.localStorage.getItem("ashiba.seen-update"));

/* ── はじめて開いたとき ── */
await page.goto(`${BASE}/training`);
await notice().waitFor({ timeout: 5000 }).catch(() => check(false, "はじめて開いたらお知らせが出る"));
check((await seen()) === null, "閉じるまでは覚えない");
check((await notice().textContent()).includes("更新のお知らせ"), "見出しが出る");
await page.screenshot({ path: `${SC}/update-01-first.png` });

/* 中身が読める。足した／直したの札が付く */
const badges = await page.locator('[data-testid="update-notice"] span').allTextContents();
check(badges.some((t) => t === "足した" || t === "直した"), "足した／直したの札が付く");
console.log("OK: はじめて開いたときに出る");

/* ── 閉じたら覚える ── */
await page.getByTestId("update-close").click();
await notice().waitFor({ state: "detached", timeout: 3000 })
  .catch(() => check(false, "閉じたら消える"));
const v = await seen();
check(!!v && /^\d{4}-\d{2}-\d{2}-\d+$/.test(v), `見たところを覚えている（${v}）`);

/* ── もう一度読み込んでも出ない ── */
await page.reload();
await page.waitForSelector("text=実務トレーニング", { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(700);
check((await notice().count()) === 0, "もう一度開いても出ない");
console.log("OK: 一度閉じれば出ない");

/* ── 章の中でも同じ ── */
await page.goto(`${BASE}/training/ch1`);
await page.waitForSelector("text=段取りと根がらみ");
await page.waitForTimeout(600);
check((await notice().count()) === 0, "章の中でも出ない");

/* ── 新しい更新が来たら、また出る ── */
await page.evaluate(() => window.localStorage.setItem("ashiba.seen-update", "2000-01-01-1"));
await page.reload();
await notice().waitFor({ timeout: 5000 })
  .catch(() => check(false, "知らない目印なら、また出る"));
await page.screenshot({ path: `${SC}/update-02-again.png` });
await page.getByTestId("update-close").click();
await page.waitForTimeout(300);
console.log("OK: 新しい更新が来たら、また出る");

/* ── 一覧はいつでも読める ── */
await page.goto(`${BASE}/updates`);
await page.waitForSelector("text=直したところ・足したところ", { timeout: 5000 })
  .catch(() => check(false, "更新の一覧が開く"));
const rows = await page.locator("text=/足した|直した/").count();
check(rows > 3, `一覧に中身が並ぶ（${rows}件）`);
await page.screenshot({ path: `${SC}/update-03-list.png` });

await page.goto(`${BASE}/training`);
await page.waitForTimeout(400);
const link = page.getByRole("link", { name: "更新の一覧を見る" });
check((await link.count()) === 1, "章の一覧から一覧へ行ける");
await link.click();
await page.waitForSelector("text=直したところ・足したところ", { timeout: 5000 })
  .catch(() => check(false, "リンクから開ける"));
console.log("OK: 更新の一覧はいつでも読める");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
