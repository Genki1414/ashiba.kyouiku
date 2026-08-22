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

/* 更新のお知らせが出ていたら閉じる（実機でも同じように一度だけ出る） */
const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

await page.goto(`${BASE}/training`);
await page.waitForSelector("text=実務トレーニング");
await dismissNotice();
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

/* ── 通し見学で操作してもらう場面 ──
   遊ぶときと同じ部品が出る。見学でも実際に操作して通す。 */

const jackNow = () => page.getByTestId("jack-now");
const hanareNow = () => page.getByTestId("hanare-now");
const levelNow = () => page.getByTestId("level-now");

/* ジャッキ：10刻みで目標150±15へ寄せてから柱を挿す */
const doJack = async () => {
  for (let i = 0; i < 40; i++) {
    const now = Number(await jackNow().getAttribute("data-value"));
    if (Math.abs(now - 150) <= 15) break;
    await page.getByRole("button", { name: now < 150 ? "上げる（10）" : "下げる（10）" }).click();
    await page.waitForTimeout(20);
  }
  await page.getByRole("button", { name: "柱を挿す" }).click();
  await page.waitForTimeout(250);
};

/* 離れ：50刻みで900へ寄せる。合うと自動で閉じる */
const doHanare = async () => {
  for (let i = 0; i < 20; i++) {
    if (!(await hanareNow().count())) break;
    const now = Number(await hanareNow().getAttribute("data-value"));
    if (now === 900) break;
    await page.getByRole("button", { name: now > 900 ? "← 押す（50）" : "引く（50）→" }).click();
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
};

/* 水平器の置き場所。的は点滅しているので座標を取って直接押す */
const tapSpot = async (label) => {
  const tgts = page.locator("g.tgt");
  const n = await tgts.count();
  for (let i = 0; i < n; i++) {
    const t = await tgts.nth(i).textContent();
    if (t && t.includes(label)) {
      const box = await tgts.nth(i).locator("circle").first().boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(250);
      return true;
    }
  }
  return false;
};

/* 気泡を合わせる。動かすのは調整側だけ */
const settleBubble = async () => {
  for (let i = 0; i < 30; i++) {
    if (!(await levelNow().count())) break;
    const o = Number(await levelNow().getAttribute("data-o"));
    if (o === 0) break;
    const btn = page
      .locator('[data-side="adj"]')
      .getByRole("button", { name: o > 0 ? "↓ 下げる" : "↑ 上げる" });
    if (!(await btn.count())) break;
    await btn.click();
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(300);
};

/* 600手摺の取付。アニメが終わるまで「次へ」は押せない */
const doRailAnim = async () => {
  const next = page.getByRole("button", { name: "次へ" });
  for (let i = 0; i < 40; i++) {
    if (await next.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(150);
  }
  await next.click();
  await page.waitForTimeout(300);
};

/* いま開いている場面を、実際に操作して閉じる */
const doDemoScene = async () => {
  for (let round = 0; round < 6; round++) {
    if (!(await page.getByTestId("demo-skip-scene").count())) return true;
    if (await jackNow().count()) { await doJack(); continue; }
    if (await hanareNow().count()) { await doHanare(); continue; }
    if (await page.getByRole("button", { name: "踏板高さの手摺を付ける" }).count()) {
      await page.getByRole("button", { name: "踏板高さの手摺を付ける" }).click();
      await page.waitForTimeout(300);
      continue;
    }
    if (await page.getByRole("button", { name: "支柱（内柱）に当てる" }).count()) {
      await page.getByRole("button", { name: "支柱（内柱）に当てる" }).click();
      await page.waitForTimeout(400);
      continue;
    }
    if (await page.locator("text=水平器をどこに置く？").count()) {
      check(await tapSpot("端から少し中"), "「端から少し中」の的がある");
      await settleBubble();
      continue;
    }
    if (await levelNow().count()) { await settleBubble(); continue; }
    if (await page.locator("text=踏板用手摺（600手摺）").count()) { await doRailAnim(); continue; }
    return false;
  }
  return (await page.getByTestId("demo-skip-scene").count()) === 0;
};

/* ── 通し見学：15手すべてに「なぜ」 ── */
await page.goto(`${BASE}/training/demo`);
await page.waitForSelector("text=組立の通し見学");
let demoScenes = 0;
for (let n = 1; n <= 15; n++) {
  /* その手に場面があれば、必ずやってから次へ進む。
     いきなり場面から始まらないこと。やる前に「次の手」は出ないこと */
  if (await page.getByTestId("demo-try").count()) {
    check(
      (await page.getByTestId("demo-skip-scene").count()) === 0,
      `${n}手目：場面がいきなり開いていない`,
    );
    check(
      (await page.getByTestId("demo-next").count()) === 0,
      `${n}手目：場面をやるまで次へ進めない`,
    );
    await page.getByTestId("demo-try").click();
    await page.waitForTimeout(200);
    if (demoScenes === 0) await page.screenshot({ path: `${SC}/cat-05b-demo-scene.png` });
    const w = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="demo-skip-scene"]')?.closest("div")?.parentElement;
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
    check(w > 0 && w <= 448, `${n}手目：場面の幅がスマホ幅に収まっている（${w}px）`);
    const ok = await doDemoScene();
    check(ok, `${n}手目：場面を操作して進められる`);
    demoScenes++;
    if (!ok) { await page.getByTestId("demo-skip-scene").click(); await page.waitForTimeout(150); }
  }
  const counter = await page.locator("main .font-mono").first().textContent();
  check(counter.includes(`${n}`), `${n}手目が出ている（表示: ${counter.trim()}）`);
  // 「なぜそうするのか」がいつも出ている（隠さない）
  const whyText = (await page.getByTestId("demo-why").textContent()).replace("なぜそうするのか", "").trim();
  check(whyText.length >= 8, `${n}手目に「なぜ」がいつも出ている（${whyText.slice(0, 16)}）`);
  if (n === 1) await page.screenshot({ path: `${SC}/cat-05-demo-1.png` });
  if (n === 4) await page.screenshot({ path: `${SC}/cat-06-demo-art.png` });
  if (n === 15) await page.screenshot({ path: `${SC}/cat-07-demo-last.png` });
  if (n < 15) {
    await page.getByTestId("demo-next").click();
    await page.waitForTimeout(90);
  }
}
check(await page.locator("text=第1章をやる").count() > 0, "最後に第1章への導線が出る");
check(demoScenes === 6, `操作してもらう場面が6箇所とも出る（いま ${demoScenes}）`);
console.log("OK: 通し見学 15手すべてに理由あり／場面6箇所を操作して通せた");

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
