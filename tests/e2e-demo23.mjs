/* 第2章・第3章の通し見学のE2E。
   手順が最後まで進み、各手に「なぜそうするのか」が付いているかを見る。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-demo23.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

/* 章の一覧から行けるか */
await page.goto(`${BASE}/training`);
await dismissNotice();
for (const ch of ["ch2", "ch3"]) {
  check(
    (await page.locator(`a[href="/training/demo/${ch}"]`).count()) === 1,
    `章の一覧から第${ch === "ch2" ? 2 : 3}章の通し見学へ行ける`,
  );
}

/* ── 場面の操作 ──
   通し見学でも、遊ぶときと同じ部品が出る。
   見ているだけでは身につかないので、ここでも実際に操作して通す。 */

/* 安全帯：正しい掛け先を選ぶ（どちらの場面でも1つ目が正解） */
const doBelt = async () => {
  await page.locator('[data-scene="belt"]').waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /支柱に付ける|入れた手摺に掛け替える/ }).first().click();
  await page.waitForTimeout(250);
  const next = page.getByRole("button", { name: "次へ" });
  if (!(await next.count())) return false;
  await next.first().click();
  await page.waitForTimeout(250);
  return true;
};

/* 手摺：低い方から。中さん450 → 上さん900 */
const doRail = async () => {
  const box = await page.locator('[data-scene="rail"]').boundingBox();
  if (!box) return false;
  const P = (x, y) => ({ x: box.x + (x / 340) * box.width, y: box.y + (y / 320) * box.height });
  const ZP = 40, ZD = 268, ZX1 = 74, ZX2 = 266;
  const zk = (n) => ZD - n * ZP;
  const mid = (ZX1 + ZX2) / 2;
  for (const n of [1, 2]) {
    const q = P(mid, zk(n));
    await page.mouse.click(q.x, q.y);
    await page.waitForTimeout(900);
  }
  const next = page.getByRole("button", { name: "次へ" });
  if (!(await next.count())) return false;
  await next.first().click();
  await page.waitForTimeout(300);
  return true;
};

/* 筋交：① 中心を持って先端を上のコマへ ② 上端を軸に振って後端を下のコマへ */
const doBrace = async () => {
  const box = await page.locator('[data-scene="brace"]').boundingBox();
  if (!box) return false;
  const P = (x, y) => ({ x: box.x + (x / 340) * box.width, y: box.y + (y / 340) * box.height });
  const ZP = 40, ZD = 268, ZX1 = 74, ZX2 = 266;
  const zk = (n) => ZD - n * ZP;
  const TOP = { x: ZX1, y: zk(5) };
  const BOT = { x: ZX2, y: zk(1) };
  const LEN = Math.hypot(TOP.x - BOT.x, TOP.y - BOT.y);
  const AF = Math.atan2(BOT.y - TOP.y, BOT.x - TOP.x);
  const AH = AF - 0.42;
  const hx = (Math.cos(AH) * LEN) / 2, hy = (Math.sin(AH) * LEN) / 2;
  const start = P(190, 200);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    const q = P(190 + ((TOP.x + hx - 190) * i) / 12, 200 + ((TOP.y + hy - 200) * i) / 12);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(20);
  }
  for (let i = 0; i <= 14; i++) {
    const th = AH + ((AF - AH) * i) / 14;
    const q = P(TOP.x + Math.cos(th) * LEN, TOP.y + Math.sin(th) * LEN);
    await page.mouse.move(q.x, q.y);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  const next = page.getByRole("button", { name: "次へ" });
  if (!(await next.count())) return false;
  await next.first().click();
  await page.waitForTimeout(300);
  return true;
};

/* 壁当てジャッキ：① 踏板手摺の直下のコマ ② 回して垂直を出す */
const doWJack = async () => {
  const box = await page.locator('[data-scene="wjack"]').boundingBox();
  if (!box) return false;
  const P = (x, y) => ({ x: box.x + (x / 340) * box.width, y: box.y + (y / 320) * box.height });
  const ZP = 40, ZD = 268, XI = 190;
  const q = P(XI, ZD - 172 + ZP);
  await page.mouse.click(q.x, q.y);
  await page.waitForTimeout(700);
  for (let i = 0; i < 12; i++) {
    if (await page.getByRole("button", { name: "次へ" }).count()) break;
    const b = page.getByRole("button", { name: /締める/ });
    if (!(await b.count())) break;
    await b.click();
    await page.waitForTimeout(120);
  }
  const next = page.getByRole("button", { name: "次へ" });
  if (!(await next.count())) return false;
  await next.first().click();
  await page.waitForTimeout(300);
  return true;
};

/* 中の当たり判定を押す（的の <g> には名前ラベルも入っている） */
const clickAt = async (loc) => {
  const inner = (await loc.locator("circle").count()) ? loc.locator("circle").first() : loc.locator("rect").first();
  const b = await inner.boundingBox();
  if (!b) return false;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(160);
  return true;
};

/* 火打：支柱どうしを、出隅から同じ距離で2箇所 */
const doHiuchi = async () => {
  await clickAt(page.locator('[data-hiuchi="a-post-1"]'));
  await clickAt(page.locator('[data-hiuchi="b-post-1"]'));
  await page.waitForTimeout(600);
  const next = page.getByRole("button", { name: "次へ" });
  if (!(await next.count())) return false;
  await next.first().click();
  await page.waitForTimeout(300);
  return (await page.getByTestId("demo-skip-scene").count()) === 0;
};

/* シートを広げる：足で挟んで押さえる */
const doSpread = async () => {
  await page.getByRole("button", { name: /足で挟/ }).first().click();
  await page.waitForTimeout(300);
  return (await page.getByTestId("demo-skip-scene").count()) === 0;
};

/* 結ぶ位置：900ピッチなので4コマ目・2コマ目、それから次の支柱へ */
const doTie = async () => {
  for (const n of [4, 2]) {
    await clickAt(page.locator(`[data-koma="${n}"]`));
    await page.waitForTimeout(160);
  }
  await page.getByRole("button", { name: /次の支柱/ }).first().click();
  await page.waitForTimeout(300);
  return (await page.getByTestId("demo-skip-scene").count()) === 0;
};

/* いま開いている場面を、実際に操作して閉じる */
const doScene = async () => {
  for (const [sel, fn] of [
    ['[data-scene="belt"]', doBelt],
    ['[data-scene="rail"]', doRail],
    ['[data-scene="brace"]', doBrace],
    ['[data-scene="wjack"]', doWJack],
    ["[data-hiuchi]", doHiuchi],
    ["[data-koma]", doTie],
  ]) {
    if (await page.locator(sel).count()) return fn();
  }
  if (await page.getByRole("button", { name: /足で挟/ }).count()) return doSpread();
  return false;
};

/* その手に場面があれば、自分で開いて、操作して進む。
   いきなり場面から始まらず「この場面をやってみる」を押してから開くこと */
const clearScene = async (shot, i) => {
  const tryBtn = page.getByTestId("demo-try");
  if (!(await tryBtn.count())) return false;
  check(
    (await page.getByTestId("demo-skip-scene").count()) === 0,
    `${i + 1}手目：場面がいきなり開いていない`,
  );
  await tryBtn.click();
  await page.waitForTimeout(200);
  if (shot) await page.screenshot({ path: shot });
  /* 広い画面でも、場面がスマホの幅より広がらない */
  const w = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="demo-skip-scene"]')?.closest("div")?.parentElement;
    return el ? Math.round(el.getBoundingClientRect().width) : 0;
  });
  check(w > 0 && w <= 448, `${i + 1}手目：場面の幅がスマホ幅に収まっている（${w}px）`);
  const ok = await doScene();
  check(ok, `${i + 1}手目：場面を操作して進められる`);
  if (!ok) { await page.getByTestId("demo-skip-scene").click(); await page.waitForTimeout(150); }
  return true;
};

const walk = async (ch, n, want, wantScenes) => {
  await page.goto(`${BASE}/training/demo/${ch}`);
  await page.waitForSelector('[data-testid="demo"]', { timeout: 8000 });
  const total = (await page.getByTestId("demo-n").textContent()).split("/")[1];
  check(Number(total) === want, `第${n}章は${want}手（いま ${total}）`);

  /* 1手ずつ最後まで。各手に「なぜ」がある */
  const seen = new Set();
  let scenes = 0;
  for (let i = 0; i < want; i++) {
    /* 場面が開いていたら、まず操作して閉じる（説明欄はその後ろにある） */
    if (await clearScene(scenes === 0 ? `${SC}/demo-${ch}-scene.png` : null, i)) scenes++;
    const title = (await page.getByTestId("demo-title").textContent()).trim();
    check(title.length > 4, `${i + 1}手目に何をするかが書いてある`);
    await page.getByTestId("demo-why-open").click();
    await page.waitForTimeout(60);
    const why = (await page.getByTestId("demo-why").textContent()).replace("なぜそうするのか", "").trim();
    check(why.length >= 12, `${i + 1}手目に「なぜ」が書いてある（${why.slice(0, 16)}）`);
    seen.add(why);
    if (i === 0) await page.screenshot({ path: `${SC}/demo-${ch}-first.png` });
    if (i === Math.floor(want / 2)) await page.screenshot({ path: `${SC}/demo-${ch}-mid.png` });
    if (i < want - 1) {
      await page.getByTestId("demo-next").click();
      await page.waitForTimeout(70);
    }
  }
  check(seen.size >= 5, `「なぜ」が使い回しだらけになっていない（${seen.size}通り）`);
  check(scenes === wantScenes, `操作してもらう場面が${wantScenes}箇所とも出る（いま ${scenes}）`);
  check((await page.getByTestId("demo-goal").count()) === 1, `最後に第${n}章へ進める`);
  await page.screenshot({ path: `${SC}/demo-${ch}-last.png` });

  /* 戻れる */
  await page.getByTestId("demo-prev").click();
  await page.waitForTimeout(80);
  check((await page.getByTestId("demo-n").textContent()).startsWith(String(want - 1)), "前の手へ戻れる");
  console.log(`OK: 第${n}章の通し見学（${want}手）`);
};

await walk("ch2", 2, 33, 7);
await walk("ch3", 3, 38, 11);

/* ── 盤面が説明欄に重なっていないか ──
   絵が縦にはみ出すと、手順の文字の上に足場が重なって読めなくなる。
   狭い画面ほど起きやすいので、いくつかの大きさで見る。 */
for (const [w, h] of [[611, 876], [390, 844], [360, 640]]) {
  await page.setViewportSize({ width: w, height: h });
  for (const url of ["/training/demo", "/training/demo/ch2", "/training/demo/ch3"]) {
    await page.goto(BASE + url);
    await dismissNotice();
    await page.waitForSelector("main svg", { timeout: 8000 });
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const svg = document.querySelector("main svg");
      const panel = document.querySelector('[data-testid="demo-panel"]') ?? document.querySelector("main > div:last-of-type");
      const a = svg.getBoundingClientRect();
      const b = panel.getBoundingClientRect();
      return { over: Math.round(a.bottom - b.top), h: Math.round(a.height) };
    });
    check(r.over <= 1, `${url} ${w}×${h}：盤面が説明欄に重なっていない（${r.over}px はみ出し）`);
    check(r.h > 60, `${url} ${w}×${h}：盤面が潰れていない（高さ ${r.h}px）`);
  }
}
console.log("OK: どの画面の大きさでも、盤面と説明が重ならない");

/* ── パソコンの広い画面で、場面が引き伸ばされないか ──
   場面は画面いっぱいに広がる作りなので、絞っておかないと
   1本の支柱が画面の高さいっぱいになって何も分からなくなる。 */
await page.setViewportSize({ width: 1440, height: 900 });
for (const [url, upto, nm] of [
  ["/training/demo", 3, "第1章"],
  ["/training/demo/ch2", 0, "第2章"],
  ["/training/demo/ch3", 0, "第3章"],
]) {
  await page.goto(BASE + url);
  await dismissNotice();
  await page.waitForSelector('[data-testid="demo-try"], [data-testid="demo-next"]', { timeout: 8000 });
  for (let k = 0; k < upto; k++) {
    await page.getByTestId("demo-next").click();
    await page.waitForTimeout(120);
  }
  check((await page.getByTestId("demo-try").count()) === 1, `${nm}：場面のある手に「やってみる」が出る`);
  await page.getByTestId("demo-try").click();
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="demo-skip-scene"]');
    const frame = bar?.closest("div")?.parentElement;
    const svg = frame?.querySelector("svg");
    return {
      frame: frame ? Math.round(frame.getBoundingClientRect().width) : 0,
      svg: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
    };
  });
  check(r.frame > 0 && r.frame <= 448, `${nm}：場面の枠がスマホ幅に収まる（${r.frame}px）`);
  check(r.svg > 0 && r.svg <= 448, `${nm}：場面の絵がスマホ幅に収まる（${r.svg}px）`);
  await page.screenshot({ path: `${SC}/demo-wide-${nm}.png` });
}
console.log("OK: 広い画面でも場面が引き伸ばされない");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
