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
/* **どちらの店にもある画面で見る。**前は /training で見ていたが、
   あれは足場屋革命だけの売り物で、特別教育ドットコムでは 404。
   お知らせは店に関係のない仕組みなので、
   売り物の画面ではなく、**人がいちばん先に開くホーム**で見る
   （2026-09-08） */
await page.goto(BASE);
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
/* 描き終わりは、どちらの店にもある講座の札で待つ（売り物の名前では待たない） */
await page.waitForSelector('[data-testid="home-course"], [data-testid="course-drawer"]', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(700);
check((await notice().count()) === 0, "もう一度開いても出ない");
console.log("OK: 一度閉じれば出ない");

/* ── 別の画面でも同じ ── */
await page.goto(`${BASE}/edu`);
await page.waitForSelector('[data-testid="course-list"]', { timeout: 8000 });
await page.waitForTimeout(600);
check((await notice().count()) === 0, "別の画面でも出ない");

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

/* **どちらの店からも辿り着けること。**前はこの札が実務トレーニングの
   画面にしかなく、特別教育ドットコムではお知らせを一度閉じたら
   二度と読めなかった（2026-09-08）。ホームの足元に置いた */
await page.goto(BASE);
await page.waitForSelector('[data-testid="home-course"], [data-testid="course-drawer"]', { timeout: 8000 });
const link = page.locator('a[href="/updates"]').first();
check((await page.locator('a[href="/updates"]').count()) >= 1, "ホームから更新の一覧へ行ける");
await link.click();
await page.waitForSelector("text=直したところ・足したところ", { timeout: 5000 })
  .catch(() => check(false, "リンクから開ける"));
console.log("OK: 更新の一覧はいつでも読める");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
