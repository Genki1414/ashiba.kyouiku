import { chromium } from "playwright-core";
const BASE = "http://localhost:3210";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.route("**/api/me", (r) => r.fulfill({ json: { ok: true, userId: "u1", name: "中川 元基", email: "n@x", admin: true, owner: true, needsJoin: false, canLearn: true, member: "active", company: "見本", bills: [], held: [], owned: [], learning: [] } }));
for (const p of ["/", "/edu", "/order", "/me"]) {
  await page.goto(`${BASE}${p}`, { waitUntil: "load" });
  const b = page.getByTestId("update-close"); if (await b.count()) await b.click().catch(()=>{});
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="bottom-nav"]');
    if (!n) return null;
    const cs = getComputedStyle(n);
    // fixed を壊す祖先を探す
    let bad = null;
    for (let e = n.parentElement; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.transform !== "none" || s.filter !== "none" || s.perspective !== "none" ||
          s.willChange.includes("transform") || s.contain.includes("paint") || s.contain.includes("layout")) {
        bad = `${e.tagName}.${e.className}`.slice(0, 60) + ` (transform:${s.transform} filter:${s.filter} contain:${s.contain})`;
        break;
      }
    }
    return { pos: cs.position, bad, h: document.documentElement.scrollHeight };
  });
  if (!r) { console.log(`${p.padEnd(8)} 下の札なし`); continue; }
  await page.evaluate(() => window.scrollTo(0, 100000));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="bottom-nav"]');
    const box = n.getBoundingClientRect();
    return { bottom: Math.round(box.bottom), vh: window.innerHeight, top: Math.round(box.top) };
  });
  const stuck = Math.abs(after.bottom - after.vh) < 2;
  console.log(`${p.padEnd(8)} position:${r.pos}  下まで送ったあと 下端${after.bottom}/画面${after.vh}  ${stuck ? "固定OK" : "**ずれている**"}  ${r.bad ? "祖先が犯人: " + r.bad : ""}`);

  /* ── 押す所の大きさと、下に空けた分（2026-09-10）──
     げんきさん「下記タブが小さくてiPhoneのバーと被って変な挙動する」。
     手元の Chromium は env(safe-area-inset-bottom) が 0 なので、
     ここで見るのは**逃げ道のほう**（env が 0 でも必ず空くか）。
     iPhone の実機では、ここに横棒のぶん（34px ほど）が入る。 */
  const size = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="bottom-nav"]');
    const a = n.querySelector('[data-testid="bottom-nav-item"]');
    const box = a.getBoundingClientRect();
    return {
      h: Math.round(box.height),
      w: Math.round(box.width),
      pad: Math.round(parseFloat(getComputedStyle(n).paddingBottom)),
      /* 隙間（spacer）が、札の高さぶん取れているか。
         足りないと、いちばん下の行が札の下に隠れる */
      nav: Math.round(n.getBoundingClientRect().height),
      spacer: Math.round(
        (document.querySelector('[aria-hidden="true"][style*="height"]')?.getBoundingClientRect().height) ?? 0,
      ),
    };
  });
  const okTap = size.h >= 44;
  const okPad = size.pad >= 10;
  const okGap = size.spacer >= size.nav;
  console.log(
    `         押す所 ${size.w}×${size.h}px ${okTap ? "OK" : "**小さい**"}` +
      ` ／ 下に空けた分 ${size.pad}px ${okPad ? "OK" : "**足りない**"}` +
      ` ／ 隙間 ${size.spacer}px と札 ${size.nav}px ${okGap ? "OK" : "**隠れる**"}`,
  );
}
await browser.close();
