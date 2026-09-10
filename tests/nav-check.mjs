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
  /* ── 送るのは本体ではなく、真ん中（2026-09-11）──
     札を貼り付けるのをやめ、外枠を縦並びにして <main> だけを動かす作りにした。
     本体はもう動かないので、window.scrollTo では何も起きない */
  await page.evaluate(() => {
    const m = document.querySelector(".shell > main");
    if (m) m.scrollTop = 1e6; else window.scrollTo(0, 100000);
  });
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
      nav: Math.round(n.getBoundingClientRect().height),
    };
  });
  /* ── 本体が止まっていて、真ん中だけが動くか（2026-09-11）──
     ここが崩れると、いちばん下の行に指が届かなくなる */
  const shell = await page.evaluate(() => {
    const m = document.querySelector(".shell > main");
    const n = document.querySelector('[data-testid="bottom-nav"]');
    return {
      mark: document.documentElement.dataset.shell ?? "",
      pos: getComputedStyle(n).position,
      body: getComputedStyle(document.body).overflow,
      canScroll: !!m && m.scrollHeight > m.clientHeight + 2,
      atEnd: !!m && m.scrollTop + m.clientHeight >= m.scrollHeight - 2,
      docOver: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  console.log(
    `         印:${shell.mark || "無し"} 札:${shell.pos} 本体:${shell.body}` +
      ` ／ ${shell.mark === "fixed" && shell.pos !== "fixed" && shell.body === "hidden" ? "貼り付けていない OK" : "**貼り付けに戻っている**"}` +
      ` ／ 本体のはみ出し ${shell.docOver}px ${shell.docOver <= 2 ? "OK" : "**本体が動く**"}` +
      (shell.canScroll ? `／ 真ん中は最後まで送れた ${shell.atEnd ? "OK" : "**届かない**"}` : ""),
  );

  const okTap = size.h >= 44;
  const okPad = size.pad >= 10;
  /* 隙間（spacer）はもう要らない。札は本体の外ではなく、並びの中に居る */
  console.log(
    `         押す所 ${size.w}×${size.h}px ${okTap ? "OK" : "**小さい**"}` +
      ` ／ 下に空けた分 ${size.pad}px ${okPad ? "OK" : "**足りない**"}` +
      ` ／ 札の高さ ${size.nav}px`,
  );
}
await browser.close();
