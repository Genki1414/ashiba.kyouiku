/* 第3章のE2E。火打4箇所 → シートを垂らす → ピッチ → 支柱に結ぶ、まで通す。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-ch3.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
const shot = (p, n) => p.screenshot({ path: `${SC}/ch3-${n}.png` });
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("pageerror:", e.message); ng++; });

const skill = async () => Number(await page.getByTestId("hud-skill").textContent());
const score = async () => Number(await page.getByTestId("hud-score").textContent());
/* 的の <g> には文字ラベルも入っているので、中の丸（無ければ矩形）を押す。
   点滅しているので座標を取って直接押す */
const clickAt = async (loc) => {
  const inner = (await loc.locator("circle").count())
    ? loc.locator("circle").first()
    : (await loc.locator("rect").count())
      ? loc.locator("rect").first()
      : loc;
  const b = await inner.boundingBox();
  if (!b) throw new Error("見つからない");
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
};


/* 更新のお知らせが出ていたら閉じる（実機でも同じように一度だけ出る） */
const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

await page.goto(`${BASE}/training/ch3`);
await page.waitForSelector("text=火打とシート");
await dismissNotice();
await shot(page, "01-plan");

/* ── 火打：4隅 ── */
for (let n = 1; n <= 4; n++) {
  /* 平面図の点滅している出隅を押す */
  await clickAt(page.locator("g.tgt circle").first());
  await page.waitForSelector("text=/の出隅/", { timeout: 8000 });
  if (n === 1) await shot(page, "02-hiuchi");

  const tgts = page.locator('[data-hiuchi]');
  const count = await tgts.count();
  check(count === 6, `取付点が6つある（いま ${count}）`);

  if (n === 1) {
    /* わざと手摺に付ける → 叱られる */
    const before = await skill();
    await clickAt(page.locator('[data-hiuchi="a-rail-1"]'));
    await clickAt(page.locator('[data-hiuchi="b-post-1"]'));
    await page.waitForTimeout(600);
    check((await skill()) < before, "手摺に付けると減点される");
    check((await page.getByTestId("hud-time").textContent()).match(/^\d\d:\d\d$/) !== null, "経過時間が出ている");
    await shot(page, "03-hiuchi-ng");
    await page.getByRole("button", { name: "やり直す" }).click();
    await page.waitForTimeout(300);
  }
  /* 出隅から同じ距離の支柱を、両方の面に1本ずつ */
  await clickAt(page.locator('[data-hiuchi="a-post-1"]'));
  await clickAt(page.locator('[data-hiuchi="b-post-1"]'));
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "次へ" }).click();
  await page.waitForTimeout(400);
}
console.log("OK: 火打4箇所");
await page.waitForSelector("text=火打が入った", { timeout: 8000 });
await shot(page, "04-hiuchi-done");

/* 火打が無いとどうなるかを見る。平面図がひし形に揺れて、元へ戻る */
const skewNow = async () => Number(await page.getByTestId("plan").getAttribute("data-skew"));
check((await skewNow()) === 0, "デモの前は傾いていない");
await page.getByTestId("see-collapse").click();
await page.waitForTimeout(450);
const mid = await skewNow();
check(mid !== 0, `ひし形に崩れて見える（skew=${mid}）`);
await shot(page, "04b-collapse");
await page.waitForTimeout(1800);
check((await skewNow()) === 0, "見終わると元の形に戻る");

await page.getByTestId("to-sheet").click();

/* ── シート：垂らす ── */
await page.waitForSelector("text=まず全スパンを垂らす", { timeout: 8000 });
await shot(page, "05-hang");
for (let i = 0; i < 3; i++) {
  await clickAt(page.locator("g.tgt").first());
  await page.waitForTimeout(300);
  /* 1枚目だけ広げ方を聞かれる */
  const foot = page.getByRole("button", { name: /足で挟/ });
  if (await foot.count()) { await foot.first().click(); }
  await page.waitForTimeout(900);
}
console.log("OK: シートを3スパン垂らした");

/* ── ピッチ ── */
await page.waitForSelector("text=緊結ピッチはどれで結ぶ？", { timeout: 8000 });
await shot(page, "06-pitch");
{
  const before = await skill();
  await page.getByRole("button", { name: /1,?800/ }).click();
  await page.waitForTimeout(400);
  check((await skill()) < before, "1800mmを選ぶと減点される");
}
await page.getByRole("button", { name: /900/ }).click();
await page.waitForTimeout(400);
console.log("OK: 緊結ピッチ900");

/* ── 結ぶ ── */
await page.waitForSelector("text=/を結ぶ/", { timeout: 8000 });
await shot(page, "07-tie");
{
  /* 出隅を先に押すと叱られる */
  const before = await skill();
  await clickAt(page.locator('[data-post="corner"]'));
  await page.waitForTimeout(500);
  check((await skill()) < before, "出隅を先に結ぶと減点される");
}
const tieOne = async (k) => {
  await clickAt(page.locator(`[data-post="${k}"]`));
  await page.waitForSelector("[data-koma]", { timeout: 8000 });
  for (const n of [4, 2]) {
    await clickAt(page.locator(`[data-koma="${n}"]`));
    await page.waitForTimeout(250);
  }
  await page.getByRole("button", { name: /次の支柱|終わり|次へ/ }).first().click();
  await page.waitForTimeout(400);
};
for (const k of ["s1", "s2", "s3", "w1", "w2", "corner"]) await tieOne(k);
console.log("OK: 6本の支柱を結んだ");

await page.waitForSelector('[data-testid="result"]', { timeout: 8000 }).catch(() => check(false, "最後まで通らなかった"));
await shot(page, "08-result");
const rank = (await page.getByTestId("result-rank").textContent()).trim();
const rScore = Number((await page.locator('[data-testid="result"] .font-mono').nth(1).textContent()).trim());
check(rScore > 0, `結果のSCOREが積み上がっている（${rScore}）`);
check(["S", "A", "B", "C"].includes(rank), `段位が出る（${rank}）`);
check((await page.locator("text=指摘された回数").count()) > 0, "指摘された回数が出る");
console.log("OK: 第3章を最後まで通せた");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
