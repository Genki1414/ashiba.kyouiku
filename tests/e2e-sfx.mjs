/* 音のE2E。実際のブラウザで、手を打つと音の再生が始まるかを見る。
   音そのものは聞けないので、Audio.play() が呼ばれたかを数える。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-sfx.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

/* Audio を差し替えて、鳴らした音を数える */
await page.addInitScript(() => {
  window.__sfx = [];
  const Real = window.Audio;
  window.Audio = class extends Real {
    constructor(src) { super(src); this.__src = src; }
    play() { window.__sfx.push(this.__src ?? this.src); return Promise.resolve(); }
  };
});

const sfx = () => page.evaluate(() => window.__sfx.length);
const lastSrc = () => page.evaluate(() => window.__sfx[window.__sfx.length - 1] ?? "");

await page.goto(`${BASE}/training/ch1`);
await page.waitForSelector("text=段取り");

check((await sfx()) === 0, "画面を出しただけでは鳴らない");

/* 根がらみ手摺を1本置く → 材料を置く音 */
const tapNode = async (key) => {
  const b = await page.locator(`[data-node="${key}"]`).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
};
await page.getByRole("button", { name: "根がらみ手摺", exact: true }).click();
await tapNode("span:C-S1");
check((await sfx()) >= 1, "手を打つと音が鳴る");
const src = await lastSrc();
check(src.startsWith("data:audio/wav;base64,"), `WAVを鳴らしている（${src.slice(0, 30)}…）`);

/* 間違った手 → 別の音（ブザー） */
const before = await lastSrc();
await tapNode("span:C-S1");
const after = await lastSrc();
check(after !== before, "間違った手では違う音が鳴る");

/* 音を切ると鳴らない。入れ直すと鳴る */
await page.getByTestId("sound-toggle").click();   // ON → OFF
await page.waitForTimeout(100);
const n0 = await sfx();
await tapNode("span:S1-S2");
check((await sfx()) === n0, "音を切ると鳴らない");

await page.getByTestId("sound-toggle").click();   // OFF → ON
await page.waitForTimeout(100);
const n1 = await sfx();
check(n1 > n0, "入れ直すと確認の音が鳴る");
await tapNode("span:S2-S3");
check((await sfx()) > n1, "入れ直すとまた鳴る");

/* 切った状態は覚えている */
await page.getByTestId("sound-toggle").click();   // ON → OFF
await page.waitForTimeout(100);
await page.goto(`${BASE}/training/ch2`);
await page.waitForSelector("text=高所作業");
/* 切ってあることは端末に覚えさせてある。読み直したあとに表示が追いつく */
await page.getByTestId("sound-toggle").filter({ hasText: "OFF" }).waitFor({ timeout: 3000 })
  .catch(async () => check(false, `別の章でも切れたまま（${(await page.getByTestId("sound-toggle").textContent()).trim()}）`));
const n2 = await sfx();
await page.getByRole("button", { name: "筋交", exact: true }).click().catch(() => {});
await page.waitForTimeout(200);
check((await sfx()) === n2, "切ったままなら鳴らない");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
