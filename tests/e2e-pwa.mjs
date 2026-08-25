/* ホーム画面に追加できるか、圏外でも開けるかを見る。
   本番の作りでないと圏外の仕込みが入らないので、この試験は自分でサーバを立てる。

   実行: npm run build のあと node tests/e2e-pwa.mjs
   （本当に電波を切るのは真似できないので、サーバごと落として確かめる） */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";

const PORT = 3210;
const BASE = `http://localhost:${PORT}`;
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 本番のサーバを立てる ── */
const server = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
  stdio: "ignore",
  detached: true,
});
const stopServer = () => {
  try { process.kill(-server.pid, "SIGKILL"); } catch { /* もう落ちている */ }
};
process.on("exit", stopServer);

let up = false;
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(BASE + "/");
    if (r.ok) { up = true; break; }
  } catch { /* まだ立っていない */ }
  await sleep(1000);
}
if (!up) { console.error("NG: サーバが立たない（先に npm run build を）"); process.exit(1); }

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

/* ── ホーム画面に追加するための書き ── */
await page.goto(BASE);
await dismissNotice();
const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
check(!!manifestHref, "manifest がつながっている");
const m = await (await fetch(BASE + manifestHref)).json();
check(m.name === "足場の特別教育", `名前（${m.name}）`);
check(m.short_name.length <= 12, `ホーム画面に出る名前は短く（${m.short_name}）`);
check(m.display === "standalone", "アプリとして開く");
check(m.start_url === "/", "開くところ");
check(m.background_color === "#14171B" && m.theme_color === "#14171B", "現場の黒に合わせてある");
check(m.icons.some((i) => i.sizes === "192x192"), "192のアイコンがある");
check(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"), "512のアイコンがある");
check(m.icons.some((i) => i.purpose === "maskable"), "丸く切られても大丈夫なアイコンがある");
for (const i of m.icons) {
  const r = await fetch(BASE + i.src);
  check(r.ok && (r.headers.get("content-type") || "").includes("png"), `アイコンが取れる（${i.src}）`);
}
check(!!(await page.getAttribute('link[rel="apple-touch-icon"]', "href")), "iPhone用のアイコンがある");
check(
  (await page.getAttribute('meta[name="theme-color"]', "content")) === "#14171B",
  "上の帯の色",
);
console.log("OK: ホーム画面に追加できる書きがそろっている");

/* ── 圏外の仕込み ── */
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 })
  .catch(() => check(false, "圏外の仕込みが入らない"));

/* 何画面か開いて、端末に写しておく */
const WARM = ["/training", "/edu/ashiba", "/training/catalog"];
for (const u of WARM) { await page.goto(BASE + u); await page.waitForTimeout(600); }
const cached = await page.evaluate(async () => {
  const c = await caches.open("ashiba-v1");
  return (await c.keys()).map((r) => new URL(r.url).pathname);
});
check(cached.includes("/offline.html"), "圏外の知らせが端末に入っている");
for (const u of WARM) check(cached.includes(u), `開いた画面が端末に入っている（${u}）`);
check(
  cached.some((p) => p.endsWith(".js")),
  "画面を動かす部品も入っている（入っていないと開いても真っ白になる）",
);
console.log(`OK: 圏外の仕込みが入った（${cached.length}件を端末に写した）`);

/* ── 本当にサーバを落として確かめる ── */
stopServer();
await sleep(2500);
check(!(await fetch(BASE + "/").then(() => true).catch(() => false)), "サーバが落ちている");

for (const u of WARM) {
  await page.goto(BASE + u).catch(() => {});
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => document.body.innerText);
  check(!t.includes("Application error"), `${u} が圏外でもちゃんと出る`);
  check(t.length > 40, `${u} が真っ白でない`);
}
await page.screenshot({ path: `${SC}/pwa-01-offline.png` });
console.log("OK: 一度開いた画面は圏外でも開ける");

/* まだ端末に入っていない先 */
await page.goto(BASE + "/zzz-mada-hiraiteinai").catch(() => {});
await page.waitForTimeout(600);
const off = await page.evaluate(() => document.body.innerText);
check(off.includes("圏外です"), `開いたことのない先は「圏外です」と出す（いま: ${off.slice(0, 40)}）`);
check(off.includes("ホームへ"), "ホームへ戻れる");
await page.screenshot({ path: `${SC}/pwa-02-offline-page.png` });
console.log("OK: 開いたことのない先は圏外の知らせが出る");

await browser.close();
stopServer();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
