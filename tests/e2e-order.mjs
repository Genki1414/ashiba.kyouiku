/* 申込みと入金のE2E。

   売り物なので、
   ・担当者でない人が申し込めないか
   ・運営でない人が入金を立てられないか
   ・Stripe の知らせが、署名なしで通らないか
   を、画面の出し分けではなく API の断り方で見る。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-order.mjs */
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
const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 2000 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

/* ── 申込みの画面 ── */
await page.goto(`${BASE}/order`);
await dismiss();
await page.waitForSelector("text=申し込", { timeout: 8000 }).catch(() => {});
const orderNg = await page.getByTestId("order-ng").count();
const orderForm = await page.getByTestId("order-seats-input").count();
check(orderNg + orderForm === 1, `「開けない理由」か「申込みの form」のどちらか（${orderNg}/${orderForm}）`);
await page.screenshot({ path: `${SC}/order-01.png` });
if (orderForm) {
  /* 人数を変えると金額が変わる */
  const money = async () => (await page.getByTestId("order-quote").innerText()).replace(/\s+/g, "");
  const a = await money();
  await page.getByTestId("order-seats-input").fill("20");
  await page.waitForTimeout(150);
  const b = await money();
  check(a !== b, "人数を変えると金額が変わる");
  console.log("OK: 申込みの画面（担当者として開けた）");
} else {
  console.log("OK: 担当者でなければ申込みの画面は開けない");
}

/* ── 運営の画面 ── */
await page.goto(`${BASE}/owner`);
await dismiss();
await page.waitForSelector("text=運営", { timeout: 8000 });
const ownerNg = await page.getByTestId("owner-ng").count();
const ownerList = await page.getByTestId("owner-totals").count();
check(ownerNg + ownerList === 1, `運営の画面も、どちらか片方（${ownerNg}/${ownerList}）`);
await page.screenshot({ path: `${SC}/order-02-owner.png` });

/* ── API の断り方 ── */
for (const [url, body, name] of [
  ["/api/order", { seats: 10, method: "invoice" }, "申込み"],
  ["/api/stripe/checkout", { orderId: "00000000-0000-0000-0000-000000000000" }, "支払い画面"],
  ["/api/owner/orders", { action: "paid", orderId: "00000000-0000-0000-0000-000000000000" }, "入金の確認"],
  ["/api/owner/orders", { action: "trial", companyId: "00000000-0000-0000-0000-000000000000", trial: true }, "無償利用の切替"],
]) {
  const r = await page.evaluate(
    async ([u, b]) => {
      const res = await fetch(u, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(b),
      });
      return { status: res.status, body: await res.text() };
    },
    [url, body],
  );
  check(r.status !== 200, `${name}は、権限が無ければ通らない（${r.status}）`);
  check(
    [400, 401, 403, 404, 409, 503].includes(r.status),
    `${name}は理由の分かる断り方をする（いま ${r.status}）`,
  );
}
console.log("OK: 権限が無ければ申込みも入金も通らない");

/* ── Stripe の知らせは署名が要る ── */
{
  const r = await page.evaluate(async () => {
    const res = await fetch("/api/stripe/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "checkout.session.completed", data: { object: { payment_status: "paid" } } }),
    });
    return res.status;
  });
  check(r === 400 || r === 503, `署名の無い知らせは通らない（${r}）`);
}
console.log("OK: Stripe の知らせは署名が要る");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
