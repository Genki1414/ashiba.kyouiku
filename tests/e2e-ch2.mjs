/* 第2章のE2E。地上→1段目→2段目→屋根まで実際のブラウザで通す。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-ch2.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
const shot = (p, n) => p.screenshot({ path: `${SC}/ch2-${n}.png` });
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("pageerror:", e.message); ng++; });

const skill = async () => Number(await page.getByTestId("hud-skill").textContent());
const score = async () => Number(await page.getByTestId("hud-score").textContent());
const bossSays = () => page.locator(".whitespace-pre-line").textContent();

/* 怒りの画面が出ていたら閉じる */
const clearScold = async () => {
  const b = page.getByRole("button", { name: "すいません！" });
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};
const tool = async (t) => { await clearScold(); await page.getByRole("button", { name: t, exact: true }).click(); };

/* 盤面の的は点滅しているので座標を取って直接押す */
const tapNode = async (key) => {
  /* 的の <g> には下の名前ラベルも入っているので、中心ではなく
     中の当たり判定（丸・四角）を押す */
  const g = page.locator(`[data-node="${key}"]`);
  const inner = (await g.locator("circle").count()) ? g.locator("circle").first() : g.locator("rect").first();
  const box = await inner.boundingBox();
  if (!box) throw new Error(`節点が無い: ${key}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(90);
  await clearScold();
};
const tapPost = (p) => tapNode(`post:${p}`);
const tapSpan = (id) => tapNode(`span:${id}`);
const climb = async () => { await clearScold(); await page.getByRole("button", { name: /上がる/ }).click(); await page.waitForTimeout(250); };

/* 場面：安全帯（正解を選んでから進む） */
const doBelt = async (label) => {
  await page.waitForSelector("text=安全帯", { timeout: 8000 });
  await page.getByRole("button", { name: label }).click();
  await page.waitForTimeout(200);
  const next = page.getByRole("button", { name: /次へ|続ける|OK|進む/ });
  if (await next.count()) { await next.first().click(); await page.waitForTimeout(250); }
};

/* 場面：筋交。実際にドラッグして入れる。
   ① 中心を持って先端を上のコマへ ② 上端を軸に振って後端を下のコマへ */
const doBrace = async () => {
  await page.waitForSelector('[data-scene="brace"]', { timeout: 8000 });
  const box = await page.locator('[data-scene="brace"]').boundingBox();
  if (!box) return false;
  /* SVG は 340x340 の座標系。画面座標へ直す */
  const P = (x, y) => ({ x: box.x + (x / 340) * box.width, y: box.y + (y / 340) * box.height });
  const ZP = 40, ZD = 268, ZX1 = 74, ZX2 = 266;
  const zk = (n) => ZD - n * ZP;
  const TOP = { x: ZX1, y: zk(5) };
  const BOT = { x: ZX2, y: zk(1) };
  const LEN = Math.hypot(TOP.x - BOT.x, TOP.y - BOT.y);
  const AF = Math.atan2(BOT.y - TOP.y, BOT.x - TOP.x);
  const AH = AF - 0.42;

  /* ① 中心を掴んで、先端が上部コマに来る位置まで動かす */
  const hx = (Math.cos(AH) * LEN) / 2, hy = (Math.sin(AH) * LEN) / 2;
  const start = P(190, 200);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const cx = 190 + ((TOP.x + hx - 190) * i) / 12;
    const cy = 200 + ((TOP.y + hy - 200) * i) / 12;
    const q = P(cx, cy);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(20);
  }
  /* ② 上端を軸に振って、後端を下部コマへ落とす */
  for (let i = 0; i <= 14; i++) {
    const th = AH + ((AF - AH) * i) / 14;
    const q = P(TOP.x + Math.cos(th) * LEN, TOP.y + Math.sin(th) * LEN);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  const next = page.getByRole("button", { name: "次へ" });
  if (await next.count()) { await next.first().click(); await page.waitForTimeout(300); return true; }
  return false;
};

/* 場面：壁当てジャッキ。
   ① 踏板手摺のすぐ下のコマを選ぶ ② 左右のボタンで回して垂直を出す */
const doWJack = async () => {
  await page.waitForSelector('[data-scene="wjack"]', { timeout: 8000 });
  const box = await page.locator('[data-scene="wjack"]').boundingBox();
  const P = (x, y) => ({ x: box.x + (x / 340) * box.width, y: box.y + (y / 320) * box.height });
  /* コマ1＝踏板手摺の直下。YD = ZD-172、450mmごと下へ */
  const ZP = 40, ZD = 268, XI = 190;
  const YD = ZD - 172;
  const q = P(XI, YD + 1 * ZP);
  await page.mouse.click(q.x, q.y);
  await page.waitForTimeout(700);
  /* 回して垂直（0）まで。-64 から 16 刻みなので「締める」を4回 */
  for (let i = 0; i < 12; i++) {
    const done = await page.getByRole("button", { name: "次へ" }).count();
    if (done) break;
    const b = page.getByRole("button", { name: /締める/ });
    if (!(await b.count())) break;
    await b.click();
    await page.waitForTimeout(120);
  }
  const next = page.getByRole("button", { name: "次へ" });
  if (await next.count()) { await next.first().click(); await page.waitForTimeout(300); return true; }
  return false;
};

/* 場面：手摺の入れ方（1段目の1本目だけ）。
   低い方から。踏板の1つ上が中さん450、2つ上が上さん900 */
const doRail = async () => {
  await page.waitForSelector('[data-scene="rail"]', { timeout: 8000 });
  await shot(page, "04a-rail-scene");
  const box = await page.locator('[data-scene="rail"]').boundingBox();
  const P = (x, y) => ({ x: box.x + (x / 340) * box.width, y: box.y + (y / 320) * box.height });
  const ZP = 40, ZD = 268, ZX1 = 74, ZX2 = 266;
  const zk = (n) => ZD - n * ZP;
  const mid = (ZX1 + ZX2) / 2;
  /* わざと上さんのコマを先に押して、低い方からだと言わせる */
  const before = await skill();
  let q = P(mid, zk(2));
  await page.mouse.click(q.x, q.y);
  await page.waitForTimeout(400);
  check((await skill()) < before, "上さんを先に押すと減点される");
  check((await score()) > 0, "HUDにSCOREが出ている");
  check((await page.getByTestId("hud-time").textContent()).match(/^\d\d:\d\d$/) !== null, "経過時間が出ている");
  await clearScold();
  /* 中さん → 上さん */
  for (const n of [1, 2]) {
    q = P(mid, zk(n));
    await page.mouse.click(q.x, q.y);
    await page.waitForTimeout(900);
  }
  const next = page.getByRole("button", { name: "次へ" });
  if (await next.count()) { await next.first().click(); await page.waitForTimeout(300); return true; }
  return false;
};


/* 更新のお知らせが出ていたら閉じる（実機でも同じように一度だけ出る） */
const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

await page.goto(`${BASE}/training/ch2`);
await page.waitForSelector("text=高所作業");
await dismissNotice();
await shot(page, "01-start");

/* ── 地上 ── */
await tool("筋交");
await tapSpan("P1-P2");
await page.waitForTimeout(200);
check((await bossSays()).length > 0, "違うスパンだと親方が言う");
await tapSpan("P2-P3");
console.log("OK: 地上から筋交の場面が開いた");
await shot(page, "02-brace-scene");
check(await doBrace(), "筋交の場面を閉じられた");

/* ── 1段目 ── */
await climb();
await shot(page, "03-belt");
await doBelt("支柱に付ける");
check((await page.locator("text=安全帯 支柱").count()) > 0, "安全帯が支柱に付いた");

await tool("手摺");
await tapSpan("P0-P1");
await page.waitForTimeout(300);
check(await doRail(), "手摺の入れ方の場面を通せた");
await doBelt("入れた手摺に掛け替える");
check((await page.locator("text=安全帯 手摺").count()) > 0, "1本目が入ったら手摺へ掛け替え");
await shot(page, "04-rail1");

await tapSpan("P1-P2");
await tapSpan("P2-P3");

/* 支柱は奥から */
await tool("支柱");
const before = await skill();
await tapPost("P0");
await page.waitForTimeout(200);
check((await skill()) < before, "手前から継ぐと減点される");
for (const p of ["P3", "P3", "P2", "P2", "P1", "P0"]) await tapPost(p);
await shot(page, "05-posts");

/* 受け材 */
await tool("踏板手摺");
await tapPost("P3");
await tapPost("P2");
await tool("ブラケット");
await tapPost("P1");
await tapPost("P0");

/* 壁当てジャッキ */
await tool("壁当てジャッキ");
await tapPost("P3");
await page.waitForTimeout(400);
await shot(page, "06-wjack");
check(await doWJack(), "壁当てジャッキの場面を閉じられた");
await tapPost("P2");
await page.waitForTimeout(400);
check(await doWJack(), "壁当てジャッキ2本目");

/* 踏板は奥から */
await tool("踏板");
for (const id of ["P2-P3", "P1-P2", "P0-P1"]) await tapSpan(id);

/* 2本目の筋交は1段目から */
await tool("筋交");
await tapSpan("P1-P2");
await page.waitForTimeout(300);
check(await doBrace(), "1段目から筋交");

/* ── 2段目 ── */
await climb();
await tool("手摺");
for (const id of ["P0-P1", "P1-P2", "P2-P3"]) await tapSpan(id);
await shot(page, "07-level2");

await tool("筋交");
await tapSpan("P0-P1");
await page.waitForTimeout(300);
check(await doBrace(), "2段目から筋交");

/* ── 屋根 ── */
await climb();
await page.waitForTimeout(300);
await tool("転落防止手摺");
for (const id of ["P0-P1", "P1-P2", "P2-P3"]) { await tapSpan(id); await tapSpan(id); }
await shot(page, "08-fall");

await page.waitForSelector('[data-testid="complete"]', { timeout: 6000 }).catch(() => check(false, "最後まで通らなかった"));
await shot(page, "09-complete");
check((await page.locator("text=この現場で入れたもの").count()) > 0, "組み上がりの内訳が出る");
await page.getByTestId("to-result").click();

await page.waitForSelector('[data-testid="result"]', { timeout: 4000 }).catch(() => check(false, "結果画面が出ない"));
await shot(page, "10-result");
const rank = (await page.getByTestId("result-rank").textContent()).trim();
check(["S", "A", "B", "C"].includes(rank), `段位が出る（${rank}）`);
const rScore = Number((await page.locator('[data-testid="result"] .font-mono').nth(1).textContent()).trim());
check(rScore > 0, `結果のSCOREが積み上がっている（${rScore}）`);
check((await page.locator("text=/タイム \\d\\d:\\d\\d/").count()) > 0, "結果にタイムが出る");
console.log("OK: 第2章を最後まで通せた");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
