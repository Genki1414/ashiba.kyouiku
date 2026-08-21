/* 第1章のE2E。段取り→建方→完了までを実際のブラウザで通す。
   実行: npm run dev -- -p 3100 のあと node e2e-ch1.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
const shot = (p, n) => p.screenshot({ path: `${SC}/ch1-${n}.png` });
let ng = 0;
const die = (m) => { console.error("NG:", m); ng++; };
const check = (c, m) => { if (!c) die(m); };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => die(`pageerror: ${e.message}`));

const skill = async () => parseInt((await page.locator("text=/技能 \\d+/").textContent()).match(/\d+/)[0], 10);

/* 怒りの画面が出ていたら閉じる（場面でのファールのとき出る） */
const clearScold = async () => {
  const b = page.getByRole("button", { name: "すいません！" });
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};
const tool = async (t) => { await clearScold(); await page.getByRole("button", { name: t, exact: true }).click(); };
/* 盤面は「押した点にいちばん近い節点」へ振り分けるので、
   印の実座標をとって、そこを実際にマウスで押す（振り分けごと確かめる） */
const tapNode = async (key) => {
  const box = await page.locator(`[data-node="${key}"]`).boundingBox();
  if (!box) throw new Error(`節点が見つからない: ${key}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(60);
  await clearScold();
};
const tapPost = (id) => tapNode(`post:${id}`);
const tapInner = (id) => tapNode(`inner:${id}`);
const tapSpan = (id) => tapNode(`span:${id}`);

/* ジャッキ合わせ：0から始まり、10刻みで目標150±15へ寄せる（プロトタイプと同じ操作） */
const doJack = async () => {
  if (!(await page.locator("text=ハンドルの高さ").count())) return false;
  for (let i = 0; i < 40; i++) {
    const now = Number(await page.getByTestId("jack-now").getAttribute("data-value"));
    if (Math.abs(now - 150) <= 15) break;
    await page.getByRole("button", { name: now < 150 ? "上げる（10）" : "下げる（10）" }).click();
    await page.waitForTimeout(20);
  }
  await page.getByRole("button", { name: "柱を挿す" }).click();
  await page.waitForTimeout(180);
  return true;
};

/* 離れ：ずれた状態から始まり、50刻みで900へ寄せる。合うと自動で閉じる */
const doHanare = async () => {
  await page.waitForSelector("text=離れを測る");
  for (let i = 0; i < 20; i++) {
    const el = page.getByTestId("hanare-now");
    if (!(await el.count())) break;
    const now = Number(await el.getAttribute("data-value"));
    if (now === 900) break;
    await page.getByRole("button", { name: now > 900 ? "← 押す（50）" : "引く（50）→" }).click();
    await page.waitForTimeout(40);
  }
  await page.waitForSelector("text=離れを測る", { state: "detached", timeout: 3000 });
  await page.waitForTimeout(120);
};


/* 水平：まず置き場所（端から少し中）を選び、そのあと気泡を合わせる。
   的は g.tgt の中の丸を押す（g の中心は文字と丸の間で、そこには当たり判定が無い） */
const tapSpot = async (label) => {
  const tgts = page.locator("g.tgt");
  const n = await tgts.count();
  for (let i = 0; i < n; i++) {
    const t = await tgts.nth(i).textContent();
    if (t && t.includes(label)) {
      /* 的は点滅しているので、座標を取って直接押す */
      const box = await tgts.nth(i).locator("circle").first().boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(250);
      return true;
    }
  }
  return false;
};

/* 気泡を合わせる。ずれ o が 0 になれば水平。調整側（進行方向側）のボタンだけ押す */
const settleBubble = async () => {
  for (let i = 0; i < 30; i++) {
    const el = page.getByTestId("level-now");
    if (!(await el.count())) break;
    const o = Number(await el.getAttribute("data-o"));
    if (o === 0) break;
    /* 動かすのは調整側だけ。基準側を触るとファールになる */
    const btn = page
      .locator('[data-side="adj"]')
      .getByRole("button", { name: o > 0 ? "↓ 下げる" : "↑ 上げる" });
    if (!(await btn.count())) break;
    await btn.click();
    await page.waitForTimeout(70);
  }
  // 合うと自動で閉じる
  await page.waitForSelector('[data-testid="level-now"]', { state: "detached", timeout: 5000 });
  await page.waitForTimeout(200);
};

const doLevel = async ({ wrongFirst = false } = {}) => {
  await page.waitForSelector("text=水平器をどこに置く？");
  const before = await skill();
  if (wrongFirst) {
    check(await tapSpot("手摺の端"), "「手摺の端」の的がある");
    check(
      (await page.locator("text=/凹んでいる/").count()) > 0,
      "端に置くと凹みの理由が親方から出る",
    );
    check((await skill()) === before, "置き場所を外しても技能点は引かない（プロトタイプと同じ）");
  }
  check(await tapSpot("端から少し中"), "「端から少し中」の的がある");
  await settleBubble();
};

/* 内柱：立てた直後 → 600手摺 → 水平器の当て先 → 内柱の水平 */
const doInner = async () => {
  await page.waitForSelector("text=次にどうする？");
  await page.getByRole("button", { name: "踏板高さの手摺を付ける" }).click();
  /* 600手摺の取付アニメが終わるのを待って「次へ」 */
  await page.waitForSelector("text=踏板用手摺（600手摺）", { timeout: 8000 });
  const next = page.getByRole("button", { name: "次へ" });
  for (let i = 0; i < 40; i++) {
    if (await next.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(150);
  }
  await next.click();
  await page.waitForSelector("text=水平器はどこに当てる？", { timeout: 10000 });
  await page.getByRole("button", { name: "支柱（内柱）に当てる" }).click();
  await page.waitForTimeout(400);
  await settleBubble();
};

const bossSays = () => page.locator(".whitespace-pre-line").textContent();

await page.goto(`${BASE}/training/ch1`);
await page.waitForSelector("text=段取りと根がらみ");

/* ── 段取り ── */
await tool("ジャッキ");
await tapPost("C");
await page.waitForTimeout(150);
check((await bossSays()).includes("手摺"), "手摺ゼロでジャッキ → 理由つきで叱られる");
check((await skill()) === 92, "ファールで技能点が減る");
await shot(page, "02-foul");

await tool("根がらみ手摺");
for (const id of ["C-S1", "S1-S2", "S2-S3", "C-E1", "E1-E2"]) { await tapSpan(id); await page.waitForTimeout(60); }
await tool("600手摺");
await tapInner("C");
await page.waitForTimeout(120);
check((await bossSays()).includes("出隅"), "出隅を内柱にすると叱られる");
for (const id of ["S3", "E2", "S1"]) { await tapInner(id); await page.waitForTimeout(60); }
await tapInner("S2");
await page.waitForTimeout(120);
check((await bossSays()).includes("2スパンに1本"), "中間の内柱2本目は一言");

await tool("ジャッキ");
for (const id of ["C", "S1", "S2", "S3", "E1", "E2"]) { await tapPost(id); await page.waitForTimeout(50); }
for (const id of ["S3", "E2", "S1"]) { await tapInner(id); await page.waitForTimeout(50); }
await shot(page, "03-dan-done");

await page.getByRole("button", { name: "建方へ進む" }).click();
await page.waitForSelector("text=よし建方だ");
console.log("OK: 段取り");

/* ── 建方：共通ステージ ── */
await tool("支柱");
await tapPost("S1");
await page.waitForTimeout(120);
check((await bossSays()).includes("出隅"), "出隅より先に南①を立てると叱られる");

await tapPost("C");
await page.waitForSelector("text=ハンドルの高さ");
await shot(page, "04-jack-scene");
check(await doJack(), "ジャッキ合わせを操作できた");
console.log("OK: ジャッキ合わせ");

await tool("手摺");
await tapSpan("S1-S2");
await page.waitForTimeout(120);
check((await bossSays()).includes("立っとる柱"), "立っていない柱のコマは叱られる");
await tapSpan("C-S1"); await page.waitForTimeout(80);
await tapSpan("C-E1"); await page.waitForTimeout(80);

await tool("支柱");
await tapPost("S1"); await page.waitForTimeout(150);
await doJack();
await tapPost("E1"); await page.waitForTimeout(150);
check(!(await page.locator("text=ハンドルの高さ").count()), "ジャッキ合わせは2回で打ち止め");
await shot(page, "05-posts-up");

/* 東①：離れ → 水平 → ブラケット */
await tool("移動"); await tapPost("E1"); await page.waitForTimeout(80);
await tool("ブラケット"); await tapPost("E1"); await page.waitForTimeout(120);
check((await bossSays()).includes("離れ"), "離れの前にブラケットは叱られる");

await page.getByRole("button", { name: "離れを見る" }).click();
await page.waitForSelector("text=離れを測る");
await shot(page, "06-hanare");
await doHanare();
console.log("OK: 離れ");

await page.getByRole("button", { name: "水平を見る" }).click();
await page.waitForSelector("text=水平器をどこに置く？");
await shot(page, "07-level");
await doLevel({ wrongFirst: true });
await shot(page, "08-level-done");
console.log("OK: 水平器の置き場所と気泡合わせ");

await tool("ブラケット"); await tapPost("E1"); await page.waitForTimeout(120);

/* 南①：内柱の箇所 */
await tool("移動"); await tapPost("S1"); await page.waitForTimeout(80);
await tool("ブラケット"); await tapPost("S1"); await page.waitForTimeout(120);
check((await bossSays()).includes("内柱"), "内柱の箇所にブラケットは叱られる");
await page.getByRole("button", { name: "離れを見る" }).click();
await doHanare();
await page.getByRole("button", { name: "水平を見る" }).click();
await doLevel();
await tool("内柱"); await tapPost("S1");
await page.waitForSelector("text=次にどうする？");
await shot(page, "09-inner");
// 順番を逆にすると叱られる
await page.getByRole("button", { name: "内柱に水平器を当てて水平を見る" }).click();
await page.waitForTimeout(250);
check((await page.locator("text=/順番が逆/").count()) > 0, "内柱の水平を先に見ると叱られる");
await page.getByRole("button", { name: "すいません！" }).click();
await page.waitForTimeout(200);
await doInner();
console.log("OK: 内柱の箇所");
await shot(page, "10-stage-a-done");

/* ── 面ごと ── */
const face = async (steps) => {
  for (const [t, kind, id] of steps) {
    if (t === "move") { await tool("移動"); await tapPost(id); await page.waitForTimeout(70); continue; }
    if (t === "hanare") {
      await page.getByRole("button", { name: "離れを見る" }).click();
      await doHanare(); continue;
    }
    if (t === "level") {
      await page.getByRole("button", { name: "水平を見る" }).click();
      await doLevel(); continue;
    }
    if (t === "innerScene") { await doInner(); continue; }
    await tool(t);
    if (kind === "post") await tapPost(id); else await tapSpan(id);
    await page.waitForTimeout(90);
    await doJack();
  }
};

// 南面
await face([
  ["ブラケット", "post", "C"],
  ["踏板", "span", "C-S1"],
  ["手摺", "span", "S1-S2"],
  ["支柱", "post", "S2"],
  ["move", "post", "S2"],
  ["hanare"], ["level"],
  ["ブラケット", "post", "S2"],
  ["踏板", "span", "S1-S2"],
  ["手摺", "span", "S2-S3"],
  ["支柱", "post", "S3"],
  ["move", "post", "S3"],
  ["hanare"], ["level"],
  ["内柱", "post", "S3"], ["innerScene"],
  ["踏板", "span", "S2-S3"],
]);
// 東面
await face([
  ["ブラケット", "post", "C"],
  ["踏板", "span", "C-E1"],
  ["手摺", "span", "E1-E2"],
  ["支柱", "post", "E2"],
  ["move", "post", "E2"],
  ["hanare"], ["level"],
  ["内柱", "post", "E2"], ["innerScene"],
  ["踏板", "span", "E1-E2"],
]);

await page.waitForSelector("text=組み上がった", { timeout: 5000 }).catch(() => die("最後まで通らなかった"));
await shot(page, "11-complete");
console.log("OK: 第1章を最後まで通せた");

const errCount = await page.locator("text=親方に言われたこと").count();
check(errCount > 0, "叱られた記録が残る");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
