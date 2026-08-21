/* 続きからのE2E。
   章の途中で閉じて、開き直したら続きから戻れるかを実際のブラウザで見る。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-resume.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
/* 同じ端末で開き直す＝同じ context のまま新しいページを開く */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
let page = await ctx.newPage();
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

const dismissNotice = async (p) => {
  const b = p.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await p.waitForTimeout(200); }
};
const tapNode = async (p, key) => {
  const r = await p.locator(`[data-node="${key}"]`).boundingBox();
  await p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await p.waitForTimeout(90);
};
const tool = (p, t) => p.getByRole("button", { name: t, exact: true }).click();
const score = async (p) => Number(await p.getByTestId("hud-score").textContent());
const skill = async (p) => Number(await p.getByTestId("hud-skill").textContent());
const bar = async (p) => p.locator("[data-bar]").getAttribute("data-bar").catch(() => null);

/* ── 第1章を途中まで進める ── */
await page.goto(`${BASE}/training/ch1`);
await dismissNotice(page);
await page.waitForSelector("text=段取りと根がらみ");
check((await page.getByTestId("resume-gate").count()) === 0, "続きが無ければ何も聞かれない");

await tool(page, "根がらみ手摺");
for (const id of ["C-S1", "S1-S2", "S2-S3"]) await tapNode(page, `span:${id}`);
/* わざと1回叱られておく。指摘も残るか見る */
await tool(page, "ジャッキ");
await tapNode(page, "post:C");
await tool(page, "根がらみ手摺");
for (const id of ["C-E1", "E1-E2"]) await tapNode(page, `span:${id}`);
await page.waitForTimeout(200);

const s0 = await score(page);
const k0 = await skill(page);
check(s0 > 0, `点が入っている（${s0}）`);
check(k0 === 100, `技能点はまだ満点（叱られたが減点なしの一言）（${k0}）`);
const saved = await page.evaluate(() => localStorage.getItem("ashiba.resume.ch1"));
check(!!saved, "途中の状態が端末に残っている");
const j = JSON.parse(saved);
check(j.ch === "ch1" && j.tutorial === true && j.sk === false, "どの現場のものかが分かる");
check(j.s.placed.filter((k) => k.startsWith("L:")).length === 5, "並べた手摺5本が残っている");
check(j.score.score === s0, "そこまでの点も残っている");
await page.screenshot({ path: `${SC}/resume-01-before.png` });
console.log("OK: 途中の状態が残る");

/* ── 閉じて、開き直す ── */
await page.close();
page = await ctx.newPage();
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });
await page.goto(`${BASE}/training/ch1`);
const gate = page.getByTestId("resume-gate");
await gate.waitFor({ timeout: 5000 }).catch(() => check(false, "続きがあると聞かれる"));
const gateText = await gate.textContent();
check(gateText.includes("途中まで残っとる"), "何が残っているか出る");
check(gateText.includes("チュートリアル"), "どのやり方だったかが出る");
await page.screenshot({ path: `${SC}/resume-02-gate.png` });
console.log("OK: 開き直すと聞かれる");

/* ── 続きから ── */
await page.getByTestId("resume-yes").click();
await page.waitForSelector("text=段取りと根がらみ", { timeout: 5000 });
await page.waitForTimeout(300);
check((await score(page)) === s0, `点が続いている（${await score(page)}）`);
const need = await page.locator('[data-check="根がらみ手摺を並べる"]').getAttribute("data-now");
check(need === "5", `並べた手摺が残っている（${need}/5）`);
check((await page.getByTestId("hud-time").textContent()) !== "00:00", "時間も続いている");
await page.screenshot({ path: `${SC}/resume-03-after.png` });
console.log("OK: 続きから戻れる");

/* ── そのまま進められる ── */
await tool(page, "600手摺");
await tapNode(page, "inner:S3");
await page.waitForTimeout(200);
const endN = await page.locator('[data-check="端部の内柱を決める"]').getAttribute("data-now");
check(endN === "1", "続きからでも手が進む");

/* ── 最初からやり直す ── */
await page.close();
page = await ctx.newPage();
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });
await page.goto(`${BASE}/training/ch1`);
await page.getByTestId("resume-no").click();
await page.waitForSelector("text=段取りと根がらみ", { timeout: 5000 });
await page.waitForTimeout(300);
check((await score(page)) === 0, "最初からなら点は0");
check(
  (await page.locator('[data-check="根がらみ手摺を並べる"]').getAttribute("data-now")) === "0",
  "盤面も空",
);
check(
  (await page.evaluate(() => localStorage.getItem("ashiba.resume.ch1"))) !== null,
  "始め直した直後の状態がまた残る",
);
console.log("OK: 最初からやり直せる");

/* ── やり方が違えば、別の現場として扱う ── */
await tool(page, "根がらみ手摺");
await tapNode(page, "span:C-S1");
await page.waitForTimeout(200);
await page.goto(`${BASE}/training/ch1?mode=honban`);
await page.waitForTimeout(600);
check(
  (await page.getByTestId("resume-gate").count()) === 0,
  "チュートリアルの続きを本番に持ち込まない",
);
await page.goto(`${BASE}/training/ch1?sk=1`);
await page.waitForTimeout(600);
check(
  (await page.getByTestId("resume-gate").count()) === 0,
  "ふつうの続きを先行手摺に持ち込まない",
);
console.log("OK: やり方が違えば別の現場");

/* ── 通し終えたら消える ── */
await page.evaluate(() => localStorage.removeItem("ashiba.resume.ch1"));
check(
  (await page.evaluate(() => localStorage.getItem("ashiba.resume.ch1"))) === null,
  "消せる",
);

/* ── 第3章：シートに入ったら、シートの手前として残る ── */
await page.goto(`${BASE}/training/ch3`);
await page.waitForSelector("text=火打とシート");
await page.waitForTimeout(300);
await page.evaluate(() => {
  /* 火打4箇所＋シート途中まで進んだ状態を直接置く（火打の場面は e2e-ch3 で通している） */
  const s = {
    phase: "tie", hiuchi: ["ne", "nw", "sw", "se"], hung: [0, 1, 2],
    footOK: true, pitch: 900, band: 0, tied: ["s1"], tying: "s2", dots: [0, 1],
  };
  localStorage.setItem("ashiba.resume.ch3", JSON.stringify({
    fmt: 1, ch: "ch3", at: new Date().toISOString(), tutorial: true, sk: false,
    s, score: { skill: 84, score: 5200, best: 6, sec: 240, hints: 0, asks: 0, errs: [] },
  }));
});
await page.goto(`${BASE}/training/ch3`);
const g3 = page.getByTestId("resume-gate");
await g3.waitFor({ timeout: 5000 }).catch(() => check(false, "第3章でも聞かれる"));
check(
  (await g3.textContent()).includes("シートの手前まで戻します"),
  "シートは手前まで戻ると断りが出る",
);
await page.screenshot({ path: `${SC}/resume-04-ch3.png` });
await page.getByTestId("resume-yes").click();
await page.waitForTimeout(600);
const left = await page.evaluate(() => JSON.parse(localStorage.getItem("ashiba.resume.ch3")).s);
check(left.hiuchi.length === 4, "火打4箇所は残る");
check(left.hung.length === 0 && left.pitch === null, "シートは手前まで戻る");
check((await skill(page)) === 84, "技能点は続いている");
console.log("OK: 第3章はシートの手前まで戻る");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
