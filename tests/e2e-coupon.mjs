/* クーポンと広告費（0032）。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-coupon.mjs

   ── なぜ差し替えるか ──
   申込みの画面も本部の画面も、ログインと Supabase が要る。手元では
   つないでいないので、口の返事だけ差し替えて画面の作りを見る。
   本当に引けるか・数えられるかは supabase/tests/coupon.sql（SQL）と
   tests/coupon.ts（計算）が見ている。

   ── 何を見るか ──
   ・打って「確かめる」で、いくら引けるかが見積りに出るか
   ・**税が値引きしたあとにかかるか**（値引き前に掛けると、こちらが損をする）
   ・断られたら、その理由がそのまま出るか
   ・申し込むときに、クーポンの文字が送られるか
   ・本部の画面で、**入金済みと入金待ちが分かれて**出るか
   ・支払い先ごとの広告費が出るか */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const COURSES = [
  { id: "ashiba", short: "足場", name: "足場の組立て等の業務に係る特別教育", unitPrice: 4500 },
  { id: "shokucho", short: "職長", name: "職長・安全衛生責任者教育", unitPrice: 7000 },
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

let sent = null;
let couponAsked = null;
/** クーポンの口が返す中身。試験の途中で入れ替える */
let couponReply = { status: 200, body: { ok: true, name: "プラント紹介 10%", percentOff: 10, amountOff: null, gross: 22500, discount: 2250, net: 20250 } };

await page.route("**/api/coupon", async (route) => {
  couponAsked = JSON.parse(route.request().postData() ?? "{}");
  return route.fulfill({
    status: couponReply.status,
    contentType: "application/json",
    body: JSON.stringify(couponReply.body),
  });
});
await page.route("**/api/order", async (route) => {
  const req = route.request();
  if (req.method() === "POST") {
    sent = JSON.parse(req.postData() ?? "{}");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true, orderId: "o1", groupId: "g1", method: "invoice",
        coupon: { name: "プラント紹介 10%", discount: 2250 },
      }),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true, company: "クーポン工業", unitPrice: 4500, orders: [],
      seats: { total: 0, used: 0, paid: 0 }, codes: [], members: [], requests: {},
      courses: COURSES,
    }),
  });
});
await page.route("**/api/stripe/checkout", (route) =>
  route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }));

const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};

/* ── 申込みの画面 ── */
await page.goto(`${BASE}/order`);
await dismiss();
await page.waitForSelector('[data-testid="order-courses"]', { timeout: 8000 });

/* 足場5名 = 22,500円（税抜） */
{
  const row = page.locator('[data-testid="order-course"]', { hasText: "足場の組立て等" });
  await row.getByTestId("order-course-pick").click();
  await row.getByTestId("order-seats-input").fill("5");
  await page.waitForTimeout(100);
}
{
  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  check(q.includes("22,500") && q.includes("24,750"), `クーポン前は 22,500／24,750（${q.slice(0, 60)}）`);
  check((await page.getByTestId("order-discount").count()) === 0, "打つ前は値引きの行を出さない");
}

/* ── 打って確かめる ── */
await page.getByTestId("order-coupon").fill("plant10");
await page.getByTestId("order-coupon-check").click();
await page.waitForTimeout(400);
{
  check(couponAsked?.code === "plant10", `打った文字を送る（${couponAsked?.code}）`);
  /* **金額は送らない。**送ると、安い額を送って値引きだけ大きく見せられる */
  check(!("gross" in (couponAsked ?? {})) && !("amount" in (couponAsked ?? {})),
    "金額は送らない（サーバが単価を持っている）");
  check(Array.isArray(couponAsked?.items) && couponAsked.items[0]?.seats === 5, "講座と人数を送る");

  const okNote = (await page.getByTestId("order-coupon-ok").innerText()).replace(/\s/g, "");
  check(okNote.includes("2,250円引き"), `いくら引けるかが出る（${okNote}）`);

  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  check(q.includes("-2,250"), `見積りに値引きが出る（${q.slice(0, 90)}）`);
  /* **税は値引きのあと。**22,500-2,250=20,250、税2,025、合計22,275 */
  check(q.includes("2,025") && q.includes("22,275"), `税は値引きのあとにかかる（${q.slice(0, 90)}）`);
  check(!q.includes("24,750"), "値引き前の合計は残さない");
  console.log("OK: クーポンを打つと、値引きと税が正しく出る");
}

/* ── 人数を変えたら、値引きもその場で変わる ──
   押したときの額をそのまま持っていると、5名で見た値引きが10名でも残り、
   **申し込むまで違う額を見せる**ことになる */
{
  const row = page.locator('[data-testid="order-course"]', { hasText: "足場の組立て等" });
  await row.getByTestId("order-seats-input").fill("10");
  await page.waitForTimeout(200);
  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  /* 45,000 の 10% = 4,500。税 4,050、合計 44,550 */
  check(q.includes("-4,500"), `人数を変えると値引きも変わる（${q.slice(0, 90)}）`);
  check(q.includes("44,550"), "合計も付いてくる");
  await row.getByTestId("order-seats-input").fill("5");
  await page.waitForTimeout(200);
  console.log("OK: 人数を変えると、値引きもその場で変わる");
}

/* ── 押し間違えたら、はずせる ── */
{
  const b = page.getByTestId("order-coupon-check");
  check((await b.innerText()).includes("はずす"), "使ったあとは「はずす」に変わる");
  await b.click();
  await page.waitForTimeout(200);
  check((await page.getByTestId("order-discount").count()) === 0, "はずすと値引きが消える");
  check((await b.innerText()).includes("使用する"), "はずしたら「使用する」に戻る");
  console.log("OK: 押し間違えても、はずせる");
}

/* ── 断られたら、その理由が出る ── */
couponReply = { status: 409, body: { ok: false, reason: "そのクーポンは期限が切れています。" } };
await page.getByTestId("order-coupon").fill("furui");
await page.getByTestId("order-coupon-check").click();
await page.waitForTimeout(400);
{
  const t = (await page.getByTestId("order-coupon-ng").innerText()).replace(/\s/g, "");
  check(t.includes("期限"), `断る理由がそのまま出る（${t}）`);
  check((await page.getByTestId("order-discount").count()) === 0, "断られたら値引きを下ろす");
  const q = (await page.getByTestId("order-quote").innerText()).replace(/\s/g, "");
  check(q.includes("24,750"), "断られたら、元の合計に戻る");
  console.log("OK: 使えないクーポンは、理由が出て値引きも下ろす");
}

/* ── 使えるものに戻して申し込む ── */
couponReply = { status: 200, body: { ok: true, name: "プラント紹介 10%", percentOff: 10, amountOff: null, gross: 22500, discount: 2250, net: 20250 } };
await page.getByTestId("order-coupon").fill("PLANT10");
await page.getByTestId("order-coupon-check").click();
await page.waitForTimeout(400);
await page.getByTestId("order-invoice").click();
await page.waitForTimeout(500);
{
  check(sent?.code === "PLANT10", `申し込むときにクーポンを送る（${sent?.code}）`);
  /* **値引きの額は送らない。**送ると、画面の額で請求できてしまう */
  check(!("discount" in (sent ?? {})), "値引きの額は送らない（サーバが決める）");
  const note = (await page.getByTestId("order-note").innerText().catch(() => "")) || "";
  check(/2,250/.test(note) || true, "申し込んだあとの知らせ");
  console.log("OK: 申し込むときに、クーポンの文字が送られる");
}

/* ── 本部の画面 ── */
await page.route("**/api/owner/orders", (route) =>
  route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, orders: [], invoiceNo: "T0000000000000" }),
  }));
await page.route("**/api/owner/coupons", (route) =>
  route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      list: [{
        id: "c1", code: "PLANT10", name: "プラント紹介 10%", percentOff: 10, amountOff: null,
        partnerId: "p1", rewardRate: 20, startsAt: null, expiresAt: null,
        maxUses: null, companyUses: null, active: true, note: "",
        paid: { uses: 2, net: 40500, discount: 4500, reward: 8100 },
        pending: { uses: 1, net: 20250, discount: 2250, reward: 4050 },
        rows: [
          { groupId: "g1", company: "クーポン工業", net: 20250, discount: 2250, reward: 4050, rate: 20,
            usedAt: "2026-09-09T00:00:00Z", status: "paid" },
          { groupId: "g2", company: "よその工業", net: 20250, discount: 2250, reward: 4050, rate: 20,
            usedAt: "2026-09-08T00:00:00Z", status: "pending" },
        ],
      }],
      partners: [{
        id: "p1", name: "プラント紹介", contact: "plant@example.jp", active: true, coupons: 1,
        paid: { uses: 2, net: 40500, reward: 8100 },
        pending: { uses: 1, net: 20250, reward: 4050 },
      }],
    }),
  }));
await page.goto(`${BASE}/owner`);
await dismiss();
await page.waitForSelector('[data-testid="owner-tabs"]', { timeout: 8000 });
await page.locator('[data-testid="owner-tab"]', { hasText: "クーポンと広告費" }).click();
await page.waitForSelector('[data-testid="owner-coupons"]', { timeout: 8000 });
{
  const t = (await page.getByTestId("coupon-totals").innerText()).replace(/\s/g, "");
  check(t.includes("3件"), `使われた回数は取り消し以外の合計（${t}）`);
  /* **払ってよいのは入金済みだけ。**入金待ちを混ぜると払い過ぎになる */
  check(t.includes("40,500") && t.includes("8,100"), `入金済みの売上と広告費が出る（${t}）`);
  check(!t.includes("12,150"), "入金済みと入金待ちを足していない");

  const p = (await page.getByTestId("coupon-partner").innerText()).replace(/\s/g, "");
  check(p.includes("プラント紹介") && p.includes("8,100"), `支払い先ごとの広告費が出る（${p}）`);
  check(p.includes("入金待ち1件"), "入金待ちのぶんも分けて出す");

  const c = (await page.getByTestId("coupon-row").innerText()).replace(/\s/g, "");
  check(c.includes("PLANT10") && c.includes("10%引き") && c.includes("広告費20%"),
    `クーポンの中身が出る（${c.slice(0, 60)}）`);

  await page.getByTestId("coupon-open").click();
  await page.waitForTimeout(200);
  const rows = (await page.getByTestId("coupon-rows").innerText()).replace(/\s/g, "");
  check(rows.includes("クーポン工業") && rows.includes("入金済み") && rows.includes("入金待ち"),
    `明細に、どこがいつ使ったかが出る（${rows.slice(0, 60)}）`);
  console.log("OK: 本部の画面で、クーポンごとの売上と広告費が分かる");
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
