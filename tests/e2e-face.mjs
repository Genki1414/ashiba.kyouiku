/* 本物の顔検出と本人照合の点検。

   受講中の照合が効いていないと、手でレンズを塞いだまま
   法定時間を積み上げられてしまう。ここが売り物の根っこなので、
   本物の写真をブラウザに読ませて、実際の判定をそのまま呼ぶ。

   ・顔が写っていれば見つかる
   ・写っていなければ（塞いだ状態）見つからない
   ・同じ人どうしは近い／別の人どうしは遠い

   写真は face-api に付いてくる見本（tests/faces/）。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-face.mjs */
import { readFileSync, readdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (c) { console.log("OK:", m); } else { console.error("NG:", m); ng++; } };

const files = readdirSync("tests/faces").filter((f) => f.endsWith(".jpg")).sort();
const imgs = Object.fromEntries(
  files.map((f) => [f, `data:image/jpeg;base64,${readFileSync(`tests/faces/${f}`).toString("base64")}`]),
);

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

/* 受講の準備の画面。ここに本物の判定が載っている */
await page.goto(`${BASE}/edu/prep`);
const close = page.getByTestId("update-close");
await close.waitFor({ timeout: 2000 }).catch(() => {});
if (await close.count()) { await close.click(); await page.waitForTimeout(200); }

await page.waitForFunction(() => !!window.__face, null, { timeout: 15000 });

/* モデルを落としてくる。はじめの1回だけ時間がかかる */
const t0 = Date.now();
await page.evaluate(() => window.__face.loadFace(), null);
console.log(`   （モデルの読み込み ${((Date.now() - t0) / 1000).toFixed(1)}秒）`);

const SAME = await page.evaluate(() => window.__face.SAME_FACE);
check(SAME > 0 && SAME <= 0.6, `同じ人と見なす距離は ${SAME}（face-api の目安 0.6 以下）`);

/* ── 写真ごとに顔を読む ── */
const read = (url) =>
  page.evaluate(async (u) => {
    const img = new Image();
    img.src = u;
    await img.decode();
    const r = await window.__face.readFace(img);
    return { count: r.count, d: r.descriptor };
  }, url);

const got = {};
for (const f of files) {
  const r = await read(imgs[f]);
  got[f] = r;
  check(r.count >= 1 && Array.isArray(r.d) && r.d.length === 128,
    `${f}：顔を見つけて特徴量128を取れる（顔 ${r.count}）`);
}

/* ── 塞いだとき（一色の絵）は顔なし ── */
{
  const blank = await page.evaluate(async () => {
    const cv = document.createElement("canvas");
    cv.width = 640; cv.height = 480;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#d8a08a";           // 手をレンズに当てた色
    ctx.fillRect(0, 0, 640, 480);
    return (await window.__face.readFace(cv)).count;
  });
  check(blank === 0, `手で塞いだ絵からは顔が見つからない（${blank}）`);
}

/* ── 同じ絵どうしは距離ゼロ ── */
{
  const f = files[0];
  const d = await page.evaluate(([a, b]) => window.__face.faceDistance(a, b), [got[f].d, got[f].d]);
  check(d < 0.001, `同じ顔どうしの距離はゼロ（${d.toFixed(3)}）`);
}

/* ── 明るさを変えても、同じ人なら近いまま ── */
{
  const dim = await page.evaluate(async (u) => {
    const img = new Image();
    img.src = u;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "rgba(0,0,0,0.25)";   // 部屋を暗くしたつもり
    ctx.fillRect(0, 0, cv.width, cv.height);
    return (await window.__face.readFace(cv)).descriptor;
  }, imgs[files[0]]);
  const d = await page.evaluate(([a, b]) => window.__face.faceDistance(a, b), [got[files[0]].d, dim]);
  check(d < SAME, `明るさが変わっても本人と分かる（距離 ${d.toFixed(3)} < ${SAME}）`);
}

/* ── 別の人どうしは遠い ── */
{
  const pairs = [];
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const d = await page.evaluate(([a, b]) => window.__face.faceDistance(a, b),
        [got[files[i]].d, got[files[j]].d]);
      pairs.push({ a: files[i], b: files[j], d });
    }
  }
  const near = pairs.filter((p) => p.d < SAME);
  console.log("   （別人どうしの距離 " +
    pairs.map((p) => `${p.a[6]}-${p.b[6]}:${p.d.toFixed(2)}`).join(" ") + "）");
  check(near.length === 0,
    near.length ? `別人なのに近すぎる組がある（${near.map((p) => `${p.a}/${p.b}=${p.d.toFixed(2)}`).join(", ")}）`
                : "別の人どうしは、すべて本人と見なさない距離");
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("\nALL OK");
