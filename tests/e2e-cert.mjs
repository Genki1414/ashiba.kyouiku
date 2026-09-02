/* 修了証のE2E。
   ・出せないときに、なぜ出せないかを言うか
   ・照会の画面が使えるか
   ・様式が崩れていないか（見本を描いて絵にする）

   本物の Supabase が無いので、記録に残す所までは見ない。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-cert.mjs */
import { chromium } from "playwright-core";
const COURSE = process.env.COURSE ?? "ashiba";
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

/* ── 出せないときは、なぜ出せないかを言う ── */
await page.goto(`${BASE}/edu/${COURSE}/cert`);
await dismissNotice();
await page.getByTestId("cert-reason").waitFor({ timeout: 6000 })
  .catch(() => check(false, "出せない理由が出る"));
const why = await page.getByTestId("cert-reason").textContent();
check(why.trim().length > 5, `理由が書いてある（${why.trim().slice(0, 30)}）`);
check((await page.getByTestId("cert-issue").count()) === 0, "出せないのに発行ボタンは出さない");
await page.screenshot({ path: `${SC}/cert-01-notyet.png` });
console.log("OK: 出せないときは理由を言う");

/* ── 照会の画面 ── */
await page.goto(`${BASE}/verify`);
await page.waitForSelector('[data-testid="verify"]');
await page.getByTestId("verify-go").click();
await page.waitForTimeout(300);
check(
  (await page.getByTestId("verify-result").textContent()).includes("形が違います"),
  "番号を入れずに押すと、形が違うと言う",
);
await page.getByTestId("verify-no").fill("AT-202608-1234");
await page.getByTestId("verify-go").click();
await page.waitForTimeout(800);
const r = await page.getByTestId("verify-result").textContent();
check(r.includes("見つかりません") || r.includes("用意されていません"), `記録が無ければそう言う（${r.trim().slice(0, 24)}）`);
await page.screenshot({ path: `${SC}/cert-02-verify.png` });
console.log("OK: 照会の画面が使える");

/* ── 様式（見本を描く）── */
await page.goto(`${BASE}/edu/${COURSE}/cert`);
await page.waitForTimeout(800);
const drawn = await page.evaluate(() => {
  const f = window.__drawCert;
  if (!f) return null;
  const cv = document.createElement("canvas");
  cv.id = "sample";
  cv.style.width = "100%";
  document.body.prepend(cv);
  /* 印の画像は置いていないかもしれない。枠だけでも描けること */
  window.__setSeal?.(null);
  f(cv, {
    courseName: "足場の組立て等の業務に係る特別教育",
    courseBasis: "労働安全衛生法第59条第3項／労働安全衛生規則第36条第39号",
    certTitle: "特 別 教 育 修 了 証",
    certLine: "特別教育を修了したことを証する。",
    name: "足場　太郎",
    birth: "1990年4月1日",
    date: "2026年8月22日",
    certNo: "AT-202608-1234",
    examScore: 18,
    examTotal: 20,
    /* 決まった名義。src/lib/issuer.ts と同じもの */
    company: "東北三上機材株式会社",
    responsible: "中川元基",
    subjects: [
      { id: 1, name: "足場及び作業の方法に関する知識", min: 180 },
      { id: 2, name: "工事用設備、機械、器具、作業環境等に関する知識", min: 30 },
      { id: 3, name: "労働災害の防止に関する知識", min: 90 },
      { id: 4, name: "関係法令", min: 60 },
    ],
  });
  return { w: cv.width, h: cv.height };
});
check(!!drawn, "見本を描ける（開発中だけ窓口に出している）");
if (drawn) {
  /* 名刺サイズ（91mm × 55mm）を300dpiで */
  check(drawn.w === 1075 && drawn.h === 650, `名刺サイズになる（${drawn.w}×${drawn.h}）`);
  await page.locator("#sample").screenshot({ path: `${SC}/cert-03-sample.png` });
  /* 白紙になっていないか。中の色の数で見る */
  const colors = await page.evaluate(() => {
    const cv = document.getElementById("sample");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    const s = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) s.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return s.size;
  });
  check(colors > 5, `白紙になっていない（${colors}色）`);

  /* 載せないと決めたものが、紙に出ていないこと。
     名刺サイズに全部は入らないので、科目・合計・試験の点数は載せない */
  const words = await page.evaluate(() => {
    /* 画面の字を直接は読めないので、描いた字を覚えておく仕掛けで見る。
       ここでは代わりに、紙の下半分に朱色（印）があるかだけ見ておく */
    const cv = document.getElementById("sample");
    const ctx = cv.getContext("2d");
    const d = ctx.getImageData(0, cv.height / 2, cv.width, cv.height / 2).data;
    let red = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 130 && d[i + 1] < 90 && d[i + 2] < 90) red++;
    }
    return red;
  });
  check(words > 50, `印の枠が右下にある（朱色の点 ${words}）`);

  /* 名義の行が、印の枠に重なっていないか。
     印の枠の中（左寄りの帯）に、黒い字が無いことで見る */
  const clash = await page.evaluate(() => {
    const cv = document.getElementById("sample");
    const ctx = cv.getContext("2d");
    /* 印は右下 118px 角。その中に黒い字が入っていれば重なっている */
    const size = 118;
    const x = cv.width - 62 - size;
    const y = cv.height - 62 - size;
    const d = ctx.getImageData(x + 6, y + 6, size - 12, size - 12).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) dark++;
    }
    return dark;
  });
  check(clash === 0, `名義の行が印の枠に入り込んでいない（黒い点 ${clash}）`);
}
console.log("OK: 様式を描ける");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
