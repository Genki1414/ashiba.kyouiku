/* スマホの画面幅での作り全体の点検。
   横にはみ出していないか、押す所が指で押せる大きさか、字が小さすぎないか。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-fit-all.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
/* iPhone SE（いちばん狭い部類）で見る */
const W = 375, H = 667;
/* 指で押せる大きさ。Apple/Google とも44ptを目安にしている。
   ここは現場の手袋も考えて、40px を割ったら知らせる */
const TAP = 40;
const SMALL_TEXT = 11;

let ng = 0;
const warn = [];
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
/* 本人確認の準備は飛ばす（受講画面そのものを見たいので） */
await ctx.addInitScript(() => {
  localStorage.setItem("ashiba.prep", JSON.stringify({
    consentedAt: null, skipped: true, faceRegistered: false, idDocument: false,
    who: { name: "", birth: "", company: "" }, faceFeature: null,
  }));
});
const page = await ctx.newPage();
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

const dismissNotice = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

/** その画面を点検する */
const audit = async (name) => {
  await page.waitForTimeout(350);
  const r = await page.evaluate(({ TAP, SMALL_TEXT, W }) => {
    const out = { over: [], small: [], tiny: [], scrollW: document.documentElement.scrollWidth };
    /* 横にはみ出している要素 */
    for (const e of document.querySelectorAll("body *")) {
      const b = e.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.right > W + 1 || b.left < -1) {
        const cs = getComputedStyle(e);
        /* わざと画面外に置いている演出は除く */
        if (cs.position === "fixed" || cs.overflow === "hidden") continue;
        out.over.push(`${e.tagName.toLowerCase()}.${(e.className || "").toString().slice(0, 30)} → ${Math.round(b.left)}〜${Math.round(b.right)}`);
      }
    }
    /* 押す所の大きさ */
    for (const e of document.querySelectorAll("button, a, [role=button]")) {
      const b = e.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.height < TAP) {
        out.small.push(`${(e.textContent || "").trim().slice(0, 14) || e.tagName} → ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
    }
    /* 小さすぎる字 */
    for (const e of document.querySelectorAll("body *")) {
      if (!e.childNodes.length) continue;
      const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if (fs && fs < SMALL_TEXT) {
        out.tiny.push(`${fs}px「${(e.textContent || "").trim().slice(0, 14)}」`);
      }
    }
    return out;
  }, { TAP, SMALL_TEXT, W });

  await page.screenshot({ path: `${SC}/fit-${name}.png`, fullPage: true });

  check(r.scrollW <= W + 1, `${name}: 横にはみ出している（${r.scrollW}px > ${W}px）`);
  check(r.over.length === 0, `${name}: 画面の外に出ている要素\n    ${r.over.slice(0, 4).join("\n    ")}`);
  if (r.small.length) warn.push(`${name}: 押しにくい（${TAP}px未満）\n    ${[...new Set(r.small)].slice(0, 6).join("\n    ")}`);
  if (r.tiny.length) warn.push(`${name}: 字が小さい（${SMALL_TEXT}px未満）\n    ${[...new Set(r.tiny)].slice(0, 6).join("\n    ")}`);
  console.log(`   ${name}  はみ出し ${r.over.length} / 押しにくい ${new Set(r.small).size} / 小さい字 ${new Set(r.tiny).size}`);
};

/* ── そのまま開ける画面 ── */
const PAGES = [
  ["home", "/"],
  ["edu-list", "/edu/ashiba"],
  ["edu-prep", "/edu/ashiba/prep"],
  ["edu-exam", "/edu/ashiba/exam"],
  ["training", "/training"],
  ["catalog", "/training/catalog"],
  ["demo", "/training/demo"],
  ["updates", "/updates"],
  ["note", "/training/note"],
  ["setup", "/setup"],
];
console.log("── そのまま開ける画面 ──");
for (const [name, url] of PAGES) {
  await page.goto(BASE + url);
  await dismissNotice();
  await audit(name);
}

/* ── 受講画面（単元の中） ── */
console.log("── 受講画面 ──");
await page.goto(`${BASE}/edu/ashiba/1-1`);
await dismissNotice();
await audit("lesson-01-narration");

/* ナレーションを最後まで送る */
for (let i = 0; i < 200; i++) {
  const next = page.getByRole("button", { name: /次へ|進む|図解へ/ }).first();
  if (!(await next.count())) break;
  if (!(await next.isEnabled().catch(() => false))) { await page.waitForTimeout(300); continue; }
  await next.click();
  await page.waitForTimeout(120);
  if (await page.locator("text=図解").count()) break;
}
await audit("lesson-02-mid");

await browser.close();
if (warn.length) {
  console.log("\n── 気になったところ ──");
  for (const w of warn) console.log("・" + w);
}
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("\nALL OK");
