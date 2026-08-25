/* 修了証のE2E。
   ・出せないときに、なぜ出せないかを言うか
   ・照会の画面が使えるか
   ・様式が崩れていないか（見本を描いて絵にする）

   本物の Supabase が無いので、記録に残す所までは見ない。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-cert.mjs */
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

/* ── 出せないときは、なぜ出せないかを言う ── */
await page.goto(`${BASE}/edu/ashiba/cert`);
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
await page.goto(`${BASE}/edu/ashiba/cert`);
await page.waitForTimeout(800);
const drawn = await page.evaluate(() => {
  const f = window.__drawCert;
  if (!f) return null;
  const cv = document.createElement("canvas");
  cv.id = "sample";
  cv.style.width = "100%";
  document.body.prepend(cv);
  f(cv, {
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
  check(drawn.w === 1240 && drawn.h === 966, `科目4つぶんの高さになる（${drawn.w}×${drawn.h}）`);
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

  /* 署名欄が本文に重なっていないか。
     印の枠の左横（本文が来てはいけない帯）に、濃い字が無いことで見る */
  const clash = await page.evaluate(() => {
    const cv = document.getElementById("sample");
    const ctx = cv.getContext("2d");
    /* 印の枠の高さの帯のうち、本文の左半分（x=150..600）。
       ここに濃い字があれば、本文が署名欄まで降りてきて重なっている */
    const top = cv.height - 145;
    const d = ctx.getImageData(150, top, 450, 95).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 100 && d[i + 1] < 100) dark++;
    return dark;
  });
  check(clash === 0, `署名欄の高さに本文が入り込んでいない（濃い点 ${clash}）`);
}
console.log("OK: 様式を描ける");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
