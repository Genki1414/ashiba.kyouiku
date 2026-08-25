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
  /* 買ったコードは、文字そのものが出ていないと配れない */
  if (await page.getByTestId("order-codes").count()) {
    const codes = page.getByTestId("order-code");
    const n = await codes.count();
    check(n > 0, "受講コードの一覧に1件以上出る");
    const first = (await codes.first().innerText()).replace(/\s+/g, "");
    check(/[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}/.test(first), `4桁ずつ区切って出る（${first}）`);
    await page.screenshot({ path: `${SC}/order-01b-codes.png` });
    console.log("OK: 受講コードの文字が出る");
  }
  console.log("OK: 申込みの画面（担当者として開けた）");
} else {
  console.log("OK: 担当者でなければ申込みの画面は開けない");
}

/* ── 受講コードの一覧 ──
   ここに Supabase が無いので、返事だけ差し替えて画面を見る。
   数だけでなく、コードの文字が出ていないと受講者に配れない。 */
{
  const CODES = [
    { code: "ABCD23456789", orderId: "o1", status: "paid", usedBy: null, usedAt: null, expiresAt: "2027-08-01T00:00:00Z" },
    { code: "KMNP23456789", orderId: "o1", status: "pending", usedBy: null, usedAt: null, expiresAt: "2027-08-01T00:00:00Z" },
    { code: "QRST23456789", orderId: "o1", status: "paid", usedBy: "田中", usedAt: "2026-08-20T00:00:00Z", expiresAt: "2027-08-01T00:00:00Z", certified: false },
    { code: "TUVW23456789", orderId: "o1", status: "paid", usedBy: "鈴木", usedAt: "2026-08-20T00:00:00Z", expiresAt: "2027-08-01T00:00:00Z", certified: true },
  ];
  await page.route("**/api/order", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            ok: true, company: "点検用工業", unitPrice: 3000,
            orders: [{ id: "o1", seats: 3, unit_price: 3000, amount: 9900, method: "invoice", status: "paid", due_date: null, paid_at: "2026-08-20T00:00:00Z", created_at: "2026-08-19T00:00:00Z" }],
            seats: { total: 4, used: 2, paid: 4 },
            codes: CODES,
          },
        })
      : route.continue(),
  );
  await page.goto(`${BASE}/order`);
  await dismiss();
  await page.getByTestId("order-codes").waitFor({ timeout: 8000 });
  const rows = page.getByTestId("order-code");
  check((await rows.count()) === 4, `4枚とも出る（${await rows.count()}）`);
  const first = (await rows.first().innerText()).replace(/\s+/g, "");
  check(/^ABCD-2345-6789/.test(first), `未使用が先で、4桁ずつ区切って出る（${first}）`);
  const all = (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ""));
  check(all.some((t) => /田中が使用/.test(t)), `使った人の名前が出る（${all.join(" | ")}）`);
  check(all.some((t) => /鈴木が使用.*修了証あり/.test(t)), "修了証を出した席は、その旨が出る");
  check((await page.getByTestId("order-code-copy").count()) === 2, "写せるのは未使用のぶんだけ");
  /* 違う人が入れてしまったときに戻せる。ただし修了証を出した人の席は戻せない */
  check((await page.getByTestId("order-code-release").count()) === 1, "取り消せるのは、修了証を出していない使用済みのぶんだけ");
  await page.getByTestId("order-code-release").click();
  check(await page.getByTestId("order-code-release-yes").isVisible(), "取り消しは二度押しで確かめる");
  check(await page.getByTestId("order-codes-copyall").isVisible(), "まとめて写すボタンが出る");
  await page.screenshot({ path: `${SC}/order-01b-codes.png`, fullPage: true });
  await page.unroute("**/api/order");
  console.log("OK: 受講コードの文字が出る");
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

/* ── 売るために要る表記 ── */
for (const [url, testid, name] of [
  ["/legal/tokushoho", "tokushoho", "特定商取引法に基づく表記"],
  ["/legal/terms", "terms", "利用規約"],
  ["/legal/privacy", "privacy", "個人情報の取扱い"],
]) {
  await page.goto(BASE + url);
  await dismiss();
  await page.waitForSelector(`[data-testid="${testid}"]`, { timeout: 8000 });
  const t = await page.locator(`[data-testid="${testid}"]`).innerText();
  check(t.replace(/\s+/g, "").length > 200, `${name} に中身がある（${t.length}字）`);
  check((await page.getByTestId("legal-nav").count()) === 1, `${name} から3ページを行き来できる`);
}
await page.screenshot({ path: `${SC}/order-03-legal.png` });
console.log("OK: 特商法・利用規約・個人情報の3ページ");

/* 未設定の欄は「未設定」と出す。埋め忘れたまま売らないように */
await page.goto(`${BASE}/legal/tokushoho`);
await dismiss();
await page.waitForSelector('[data-testid="tokushoho"]');
const miss = await page.getByTestId("tokushoho-missing").count();
console.log(`   （未設定の欄 ${miss}件）`);

/* ホームから読める（登録していない人も買う前に読む） */
await page.goto(BASE);
await dismiss();
await page.waitForSelector("text=実務トレーニング");
for (const href of ["/legal/tokushoho", "/legal/terms", "/legal/privacy"]) {
  check((await page.locator(`a[href="${href}"]`).count()) >= 1, `ホームから ${href} へ行ける`);
}
console.log("OK: ホームから表記へ行ける");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
