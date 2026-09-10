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
}
await browser.close();
