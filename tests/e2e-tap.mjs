/* 盤面のタップの当たり方をスマホの画面幅で確かめる。
   指は太いので、印の真ん中から少しずれても、狙った所が反応してほしい。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-tap.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
/* iPhone くらいの画面 */
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

const center = async (key) => {
  const r = await page.locator(`[data-node="${key}"]`).boundingBox();
  if (!r) throw new Error(`節点が無い: ${key}`);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
/* 印の真ん中から dx,dy だけ外して押す */
const tapNear = async (key, dx = 0, dy = 0) => {
  const c = await center(key);
  await page.mouse.click(c.x + dx, c.y + dy);
  await page.waitForTimeout(90);
};
const skill = async () => Number(await page.getByTestId("hud-skill").textContent());
/* 段取りのチェック欄の「いま/必要」を読む */
const need = async (label) => {
  const el = page.locator(`[data-check="${label}"]`);
  return `${await el.getAttribute("data-now")}/${await el.getAttribute("data-need")}`;
};
const tool = async (t) => { await page.getByRole("button", { name: t, exact: true }).click(); };


/* 更新のお知らせが出ていたら閉じる（実機でも同じように一度だけ出る） */
const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

await page.goto(`${BASE}/training/ch1`);
await page.waitForSelector("text=段取りと根がらみ");
await dismissNotice();
await page.waitForTimeout(300);

/* ── 印どうしの画面上の間隔 ── */
const gap = await page.evaluate(() => {
  const g = (k) => {
    const r = document.querySelector(`[data-node="${k}"]`).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const d = (a, b) => Math.hypot(g(a).x - g(b).x, g(a).y - g(b).y);
  return {
    postInner: d("post:C", "inner:C"),
    postPost: d("post:C", "post:S1"),
    postSpan: d("post:C", "span:C-S1"),
    spanSpan: d("span:C-S1", "span:S1-S2"),
  };
});
console.log("印の間隔(px)", JSON.stringify(gap));
check(gap.postPost > 60, `柱どうしは指1本ぶん以上あいている（${gap.postPost.toFixed(0)}px）`);
check(gap.postSpan > 30, `柱とスパンがあいている（${gap.postSpan.toFixed(0)}px）`);
check(gap.spanSpan > 60, `スパンどうしがあいている（${gap.spanSpan.toFixed(0)}px）`);

/* ── 根がらみ手摺：スパンしか押せない ── */
await tool("根がらみ手摺");
const before = await skill();
/* 柱の真上を押しても、いちばん近いスパンが反応する。柱には何も起きない */
await tapNear("post:C");
check((await skill()) === before, "柱を押しても減点にならない");
check((await need("根がらみ手摺を並べる")) === "1/5", "柱の上を押しても、いちばん近いスパンに入る");

/* 印から12pxずらして押しても、狙ったスパンに入る */
for (const [id, dx, dy] of [
  ["span:C-S1", 12, 6], ["span:S1-S2", -12, -6], ["span:S2-S3", 10, -8], ["span:E1-E2", -10, 8],
]) {
  await tapNear(id, dx, dy);
}
check((await need("根がらみ手摺を並べる")) === "5/5", "ずらして押しても5本とも並んだ");
check((await skill()) === before, "5本並べるあいだ一度も減点されない");
await page.screenshot({ path: `${SC}/tap-01-ledgers.png` });
console.log("OK: 根がらみ手摺はスパンだけが反応する");

/* ── 600手摺：内柱の側しか押せない ── */
await tool("600手摺");
await tapNear("post:S3", 0, 0);   // 柱の真上。内柱の側に振り分けられる
check((await need("端部の内柱を決める")) === "1/2", "柱の上を押しても内柱の側に入る");
await tapNear("inner:E2", 8, -4);
check((await need("端部の内柱を決める")) === "2/2", "端部2本が決まった");
await tapNear("inner:S1", -8, 4);
check((await need("中間の内柱を決める")) === "1/1", "中間の内柱が決まった");
console.log("OK: 600手摺は内柱の側だけが反応する");

/* ── ジャッキ：柱と内柱の両方が押せる。まだ置いていない方が先に取られる ── */
await tool("ジャッキ");
const jackBefore = await skill();
for (const id of ["C", "S1", "S2", "S3", "E1", "E2"]) {
  await tapNear(`post:${id}`, 0, 0);
}
check((await need("柱の位置にジャッキ")) === "6/6", "柱6本にジャッキが入った");
check((await need("内柱の位置にジャッキ")) === "0/3", "内柱側にはまだ入っていない");
/* 柱は済んだので、同じ所を押すと今度は内柱の側が取られる */
for (const id of ["S3", "E2", "S1"]) {
  await tapNear(`inner:${id}`, 0, 0);
}
check((await need("内柱の位置にジャッキ")) === "3/3", "内柱3本にもジャッキが入った");
check((await skill()) === jackBefore, "ジャッキを配るあいだ一度も減点されない");
await page.screenshot({ path: `${SC}/tap-02-dan-done.png` });
console.log("OK: ジャッキは柱→内柱の順に取られる");

/* ── 建方：内柱の側は押せない（柱かスパンだけ） ── */
await page.getByRole("button", { name: "建方へ進む" }).click();
await page.waitForSelector("text=よし建方だ");
await page.waitForTimeout(200);
const tateGap = await page.evaluate(() => {
  const g = (k) => {
    const r = document.querySelector(`[data-node="${k}"]`).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const d = (a, b) => Math.hypot(g(a).x - g(b).x, g(a).y - g(b).y);
  return { postSpan: d("post:C", "span:C-S1"), boardH: document.querySelector("main svg").getBoundingClientRect().height };
});
console.log("建方の間隔(px)", JSON.stringify(tateGap));
check(tateGap.postSpan > 30, `建方でも柱とスパンがあいている（${tateGap.postSpan.toFixed(0)}px）`);
check(tateGap.boardH < 420, `盤面が画面に収まる高さ（${tateGap.boardH.toFixed(0)}px）`);

await tool("支柱");
/* 内柱の側を押しても、柱として扱われる（建方で内柱の側は押さない） */
const t0 = await skill();
await tapNear("inner:C", 0, 0);
await page.waitForSelector("text=ハンドルの高さ", { timeout: 5000 })
  .catch(() => check(false, "内柱の側を押しても出隅の柱として扱われる"));
check((await skill()) === t0, "内柱の側を押しても減点されない");
await page.screenshot({ path: `${SC}/tap-03-tate.png` });
console.log("OK: 建方では柱とスパンだけが反応する");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
