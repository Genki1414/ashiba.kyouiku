/* ひとりで受ける（0039）の画面。
   ここに Supabase は無いので、口の返事を差し替えて画面の出し分けを見る。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-solo.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

const courses = [
  { id: "ashiba", name: "足場の組立て等の業務に係る特別教育", short: "足場", unitPrice: 4500 },
  { id: "ishiwata", name: "石綿使用建築物等解体等業務に係る特別教育", short: "石綿", unitPrice: 4500 },
];
let reply = { name: "試験 太郎", card: false, courses, learning: [], pending: [] };
let sent = null;
let couponAsked = null;
await page.route("**/api/solo", async (route) => {
  const req = route.request();
  if (req.method() === "POST") {
    sent = JSON.parse(req.postData() ?? "{}");
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, orderId: "o-solo-1", method: sent.method, amount: 4455, due: "2026-09-24", coupon: null }),
    });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ...reply }) });
});
await page.route("**/api/coupon", async (route) => {
  couponAsked = JSON.parse(route.request().postData() ?? "{}");
  return route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, name: "資材屋 10%", percentOff: 10, amountOff: null }),
  });
});
const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};

/* ── 申込みの画面（講座は住所から） ── */
await page.goto(`${BASE}/solo?courseId=ishiwata`);
await dismiss();
await page.getByTestId("solo-go").waitFor({ timeout: 8000 });
check(await page.getByTestId("solo-course").inputValue() === "ishiwata", "住所で渡した講座が選ばれている");
check((await page.getByTestId("solo-billto").inputValue()) === "試験 太郎", "宛名の既定は登録した氏名");
const price = (await page.getByTestId("solo-price").innerText()).replace(/\s+/g, "");
check(price === "4,950円", `税込が出る（${price}）`);
check((await page.getByTestId("solo-method-card").count()) === 0, "カードの鍵が無い店では、カードの札を出さない");
check((await page.getByTestId("solo-join").count()) === 1, "会社で受ける道も残っている");
check((await page.locator('a[href="/legal/tokushoho"]').count()) >= 1, "特商法の表記へ行ける");
await page.screenshot({ path: `${SC}/solo-01.png` });

/* クーポンを確かめると、値引き後の額になる */
await page.getByTestId("solo-coupon").fill("shizai10");
await page.getByTestId("solo-coupon-go").click();
await page.getByTestId("solo-coupon-ok").waitFor({ timeout: 4000 });
check(couponAsked?.items?.[0]?.courseId === "ishiwata" && couponAsked?.items?.[0]?.seats === 1, "クーポンの確かめは、その講座1名分で聞く");
const price2 = (await page.getByTestId("solo-price").innerText()).replace(/\s+/g, "");
check(price2 === "4,455円", `値引き後の税込（4,050 + 405）が出る（${price2}）`);

/* 申し込む → 確かめる札 → 終わった → 申し込みましたの画面 */
await page.getByTestId("solo-go").click();
await page.getByTestId("ask-done-yes").waitFor({ timeout: 4000 });
const body = await page.getByTestId("ask-done").innerText();
check(/石綿/.test(body) && /1名分/.test(body) && /4,455円/.test(body), "札に講座・1名分・税込が出る");
check(/受講コードを打つ必要はありません/.test(body), "コードを打たなくてよいと書いてある");
await page.getByTestId("ask-done-yes").click();
await page.getByTestId("ask-done-close").waitFor({ timeout: 8000 });
check(sent?.courseId === "ishiwata" && sent?.method === "invoice" && sent?.code === "shizai10", `送った中身（${JSON.stringify(sent)}）`);
check(!("amount" in (sent ?? {})), "金額は送らない（サーバが出す）");
await page.getByTestId("ask-done-close").click();
await page.getByTestId("solo-done").waitFor({ timeout: 4000 });
const done = await page.getByTestId("solo-done").innerText();
check(/4,455円/.test(done) && /2026\/9\/24/.test(done), `申し込みましたに金額と期限（${done.replace(/\s+/g, " ")}）`);
check((await page.getByTestId("solo-invoice").getAttribute("href")) === "/invoice/o-solo-1", "請求書へ行ける");
await page.screenshot({ path: `${SC}/solo-02-done.png` });
console.log("OK: ひとりで受ける（申込み→札→請求書）");

/* ── もう受講できる講座 ── */
reply = { ...reply, learning: ["ashiba"] };
await page.goto(`${BASE}/solo?courseId=ashiba`);
await dismiss();
await page.getByTestId("solo-already").waitFor({ timeout: 8000 });
check((await page.getByTestId("solo-go").count()) === 0, "もう受けられる講座には申込みの札を出さない");
console.log("OK: もう受講できる講座は、開く方へ");

/* ── 入金待ちの申込みがある講座 ── */
reply = { ...reply, learning: [], pending: [{ id: "o-p1", course_id: "ashiba", amount: 4950, due_date: "2026-09-30", bill_to: "試験 太郎", method: "invoice" }] };
await page.goto(`${BASE}/solo?courseId=ashiba`);
await dismiss();
await page.getByTestId("solo-pending").waitFor({ timeout: 8000 });
check((await page.getByTestId("solo-go").count()) === 0, "入金待ちがあれば、二重に申し込ませない");
check(/2026\/9\/30/.test(await page.getByTestId("solo-pending").innerText()), "支払期限が出る");
/* 講座を変えれば申し込める */
await page.getByTestId("solo-course").selectOption("ishiwata");
await page.getByTestId("solo-go").waitFor({ timeout: 4000 });
console.log("OK: 入金待ちの講座は請求書へ、ほかの講座は申し込める");

/* ── カードの鍵がある店 ── */
reply = { ...reply, card: true, pending: [] };
await page.goto(`${BASE}/solo`);
await dismiss();
await page.getByTestId("solo-method-card").waitFor({ timeout: 8000 });
await page.getByTestId("solo-method-card").click();
check(/カードで支払う/.test(await page.getByTestId("solo-go").innerText()), "カードを選ぶと札の字が変わる");
console.log("OK: カードは鍵がある店でだけ");

/* ── ログインが無いときの返事 ── */
await page.unroute("**/api/solo");
await page.route("**/api/solo", (route) =>
  route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "ログインが必要です。" }) }));
await page.goto(`${BASE}/solo`);
await dismiss();
await page.getByTestId("solo-note").waitFor({ timeout: 8000 });
check(/ログイン/.test(await page.getByTestId("solo-note").innerText()), "断られた理由が出る");

await browser.close();
if (ng) { console.error(`${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
