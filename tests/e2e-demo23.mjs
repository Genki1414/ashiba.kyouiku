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

const walk = async (ch, n, want) => {
  await page.goto(`${BASE}/training/demo/${ch}`);
  await page.waitForSelector('[data-testid="demo"]', { timeout: 8000 });
  const total = (await page.getByTestId("demo-n").textContent()).split("/")[1];
  check(Number(total) === want, `第${n}章は${want}手（いま ${total}）`);

  /* 1手ずつ最後まで。各手に「なぜ」がある */
  const seen = new Set();
  for (let i = 0; i < want; i++) {
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
  check((await page.getByTestId("demo-goal").count()) === 1, `最後に第${n}章へ進める`);
  await page.screenshot({ path: `${SC}/demo-${ch}-last.png` });

  /* 戻れる */
  await page.getByTestId("demo-prev").click();
  await page.waitForTimeout(80);
  check((await page.getByTestId("demo-n").textContent()).startsWith(String(want - 1)), "前の手へ戻れる");
  console.log(`OK: 第${n}章の通し見学（${want}手）`);
};

await walk("ch2", 2, 33);
await walk("ch3", 3, 38);

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
      const panel = document.querySelector("main > div:last-of-type");
      const a = svg.getBoundingClientRect();
      const b = panel.getBoundingClientRect();
      return { over: Math.round(a.bottom - b.top), h: Math.round(a.height) };
    });
    check(r.over <= 1, `${url} ${w}×${h}：盤面が説明欄に重なっていない（${r.over}px はみ出し）`);
    check(r.h > 60, `${url} ${w}×${h}：盤面が潰れていない（高さ ${r.h}px）`);
  }
}
console.log("OK: どの画面の大きさでも、盤面と説明が重ならない");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
