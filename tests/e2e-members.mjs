/* 会員制度（0040・docs/120）の画面。
   ここに Supabase は無いので、口の返事を差し替えて画面の出し分けを見る。
   実行: MEMBERSHIP_ENABLED=1 npm run dev -- -p 3100 のあと node tests/e2e-members.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });
const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};
const confirmDone = async () => {
  await page.getByTestId("ask-done-yes").waitFor({ timeout: 4000 });
  await page.getByTestId("ask-done-yes").click();
  await page.getByTestId("ask-done-close").waitFor({ timeout: 8000 });
  await page.getByTestId("ask-done-close").click();
  await page.waitForTimeout(150);
};
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const plans = [
  { id: "p1", kind: "member", name: "ライト", monthlyFee: 5000, ticketAmount: 10000, ticketMonths: 6, public: true, sortOrder: 1, note: "" },
  { id: "p2", kind: "member", name: "スタンダード", monthlyFee: 10000, ticketAmount: 20000, ticketMonths: 6, public: true, sortOrder: 2, note: "" },
];

/* ── 案内（ログイン無し）── */
for (const [path, cta] of [["/members", "lp-members-cta"], ["/agency", "lp-agency-cta"], ["/partners", "lp-partners-cta"]]) {
  const res = await page.goto(`${BASE}${path}`);
  check(res.status() === 200, `${path} が開く（${res.status()}）`);
  await dismiss();
  await page.getByTestId("lp").waitFor({ timeout: 8000 });
  check((await page.getByTestId(cta).count()) === 1, `${path} に押す所がある`);
  const note = await page.getByTestId("lp-note").innerText();
  check(/6か月で失効/.test(note) && /自動更新/.test(note) && /返金はなく/.test(note), `${path} に条件（6か月・自動更新・返金なし）`);
  check((await page.getByTestId("bottom-nav").count()) === 0, `${path} に下の札は出ない`);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".lp")).backgroundColor);
  check(bg === "rgb(255, 255, 255)", `${path} は白地（${bg}）`);
  await page.screenshot({ path: `${SC}/members-lp${path.replace(/\//g, "-")}.png`, fullPage: true });
}
/* プランが出る（データベースが無いので既定値） */
await page.goto(`${BASE}/members`);
await dismiss();
await page.getByTestId("lp-plans").waitFor({ timeout: 8000 });
check((await page.getByTestId("lp-plan").count()) === 4, "法人会員の案内に4プラン");
check(/10,000円/.test(await page.getByTestId("lp-plans").innerText()), "スタンダード 10,000円が出る");
/* シミュレーター */
await page.goto(`${BASE}/partners`);
await dismiss();
await page.getByTestId("lp-sim").waitFor({ timeout: 8000 });
const m0 = (await page.getByTestId("lp-sim-monthly").innerText()).replace(/\s/g, "");
check(m0 === "30,000円", `10社 × スタンダード × 30% = 30,000円（${m0}）`);
await page.getByTestId("lp-sim-range").fill("20");
await page.waitForTimeout(100);
const m1 = (await page.getByTestId("lp-sim-monthly").innerText()).replace(/\s/g, "");
check(m1 === "60,000円", `20社なら 60,000円（${m1}）`);
check((await page.getByTestId("lp-sim-yearly").innerText()).replace(/\s/g, "") === "720,000円", "年は12倍");
console.log("OK: 案内3枚とシミュレーター");

/* ── 紹介 URL：クッキーを置いて案内へ ── */
{
  const res = await page.goto(`${BASE}/ref?code=abcd2345`);
  check(new URL(page.url()).pathname === "/members", `紹介 URL は案内へ送る（${page.url()}）`);
  check(res.status() === 200, "着いた先が開く");
  const cookies = await page.context().cookies(BASE);
  const ref = cookies.find((c) => c.name === "ref");
  check(ref?.value === "ABCD2345" && ref.httpOnly, `紹介コードがクッキーに乗る（${JSON.stringify(ref)}）`);
  await page.goto(`${BASE}/ref?code=<bad>`);
  check(new URL(page.url()).pathname === "/members", "壊れたコードでも案内へ");
  console.log("OK: 紹介 URL");
}

/* ── 法人会員：申し込む ── */
let member = { ok: true, company: "試験建設", plans, refCode: "ABCD2345", contract: null, balance: { total: 0, expiring: 0, nextExpire: null }, lots: [], txns: [], payments: [] };
let sent = null;
await page.route("**/api/member/contract", (route) => {
  if (route.request().method() === "POST") {
    sent = JSON.parse(route.request().postData() ?? "{}");
    return route.fulfill(json({ ok: true, contractId: "c1", paymentId: "pay1", plan: { id: "p2", name: "スタンダード", monthlyFee: 10000 }, referred: true }));
  }
  return route.fulfill(json(member));
});
await page.goto(`${BASE}/member`);
await dismiss();
await page.getByTestId("member-plans").waitFor({ timeout: 8000 });
check((await page.getByTestId("member-plan").count()) === 2, "プランが並ぶ");
check((await page.getByTestId("member-code").inputValue()) === "ABCD2345", "紹介 URL のコードが埋まっている");
check(await page.getByTestId("member-apply").isDisabled(), "プランを選ぶまで押せない");
await page.getByTestId("member-plan").nth(1).click();
check(!(await page.getByTestId("member-apply").isDisabled()), "選べば押せる");
await page.screenshot({ path: `${SC}/members-01-apply.png` });
await page.getByTestId("member-apply").click();
await page.getByTestId("ask-done-yes").waitFor({ timeout: 4000 });
const body = await page.getByTestId("ask-done").innerText();
check(/スタンダード/.test(body) && /10,000円/.test(body) && /11,000円/.test(body) && /20,000円/.test(body), `札に名前・税抜・税込・チケット（${body.replace(/\s+/g, " ")}）`);
/* 申し込んだあとは契約が出る */
member = {
  ...member,
  contract: { id: "c1", kind: "member", status: "pending", method: "invoice", startedOn: null, endsOn: null, nextDueOn: null, cancelRequestedOn: null, createdAt: "2026-11-25T01:00:00Z", plan: plans[1] },
  payments: [{ id: "pay1", periodMonth: "2026-11-01", net: 10000, tax: 1000, amount: 11000, ticketAmount: 20000, method: "invoice", status: "pending", dueOn: "2026-11-01", invoicedAt: null, paidAt: null }],
};
await confirmDone();
check(sent?.planId === "p2" && sent?.code === "ABCD2345", `送った中身（${JSON.stringify(sent)}）`);
check(!("monthlyFee" in (sent ?? {})) && !("amount" in (sent ?? {})), "金額は送らない");
await page.getByTestId("member-contract").waitFor({ timeout: 8000 });
check(/入金待ち/.test(await page.getByTestId("member-status").innerText()), "契約は入金待ち");
check((await page.getByTestId("member-wait").count()) === 1, "入金が確認されるとチケットが付く、と出る");
check((await page.getByTestId("member-order").count()) === 0, "残高 0 ではチケットで申し込む札を出さない");
check(/未発行|運営が発行/.test(await page.getByTestId("member-bill").innerText()), "請求書はまだ発行されていないと出る");
await page.screenshot({ path: `${SC}/members-02-pending.png` });
console.log("OK: 法人会員の申込み → 入金待ち");

/* ── 有効になった ── */
member = {
  ...member,
  contract: { ...member.contract, status: "active", startedOn: "2026-11-01", endsOn: "2027-10-31", nextDueOn: "2026-12-01" },
  balance: { total: 20000, expiring: 0, nextExpire: "2027-11-25T01:00:00Z" },
  lots: [{ id: "l1", amount: 20000, remaining: 20000, grantedAt: "2026-11-25T01:00:00Z", expiresAt: "2027-11-25T01:00:00Z" }],
  txns: [{ id: "t1", kind: "grant", amount: 20000, orderId: null, note: "2026-11 分の付与", at: "2026-11-25T01:00:00Z" }],
  payments: [{ ...member.payments[0], status: "paid", invoicedAt: "2026-11-25T00:00:00Z", paidAt: "2026-11-25T01:00:00Z" }],
};
await page.goto(`${BASE}/member`);
await dismiss();
await page.getByTestId("member-balance").waitFor({ timeout: 8000 });
check(/20,000円/.test(await page.getByTestId("member-balance").innerText()), "残高が出る");
check((await page.getByTestId("member-order").getAttribute("href")) === "/order", "チケットで申し込む札は /order へ");
check((await page.getByTestId("member-bill").count()) === 0, "入金待ちが無ければ支払いの札は出ない");
check(/付与/.test(await page.getByTestId("member-txns").innerText()), "履歴に付与が出る");
await page.screenshot({ path: `${SC}/members-03-active.png` });
/* 解約の申し出（docs/121）：翌月末で終了。札に「返金はありません」と出る */
await page.getByTestId("member-cancel-go").waitFor({ timeout: 4000 });
await page.unroute("**/api/member/contract");
await page.route("**/api/member/contract", (route) => {
  if (route.request().method() === "POST") {
    sent = JSON.parse(route.request().postData() ?? "{}");
    member = { ...member, contract: { ...member.contract, cancelRequestedOn: "2026-11-25", endsOn: "2026-12-31", nextDueOn: null } };
    return route.fulfill(json({ ok: true, endsOn: "2026-12-31" }));
  }
  return route.fulfill(json(member));
});
await page.getByTestId("member-cancel-go").click();
await page.getByTestId("ask-done-yes").waitFor({ timeout: 4000 });
const cb = await page.getByTestId("ask-done").innerText();
check(/翌月末/.test(cb) && /返金はありません/.test(cb), `解約の札に翌月末と返金なし（${cb.replace(/\s+/g, " ")}）`);
await confirmDone();
check(sent?.action === "cancel", `解約を送る（${JSON.stringify(sent)}）`);
await page.getByTestId("member-cancel").waitFor({ timeout: 8000 });
check(/2026\/12\/31/.test(await page.getByTestId("member-cancel").innerText()), "申し出のあと、終了日が出る");
check((await page.getByTestId("member-cancel-go").count()) === 0, "二度は申し出させない");
console.log("OK: 有効な契約の画面と解約の申し出");

/* ── 受講コードの申込みに「チケットで払う」 ── */
const courses = [
  { id: "ashiba", short: "足場", name: "足場の組立て等", unitPrice: 4500 },
  { id: "ishiwata", short: "石綿", name: "石綿", unitPrice: 4500 },
];
let orderSent = null;
await page.route("**/api/order", (route) => {
  if (route.request().method() === "POST") {
    orderSent = JSON.parse(route.request().postData() ?? "{}");
    return route.fulfill(json({ ok: true, orderId: "o1", groupId: "g1", course: { id: "ashiba", short: "足場" }, items: [{ courseId: "ashiba", short: "足場", seats: 2, amount: 9900 }], method: "ticket", coupon: null, quote: { seats: 2, total: 9900 }, seatsIssued: 2, ticket: { spent: 9000, left: 11000 } }));
  }
  return route.fulfill(json({ ok: true, company: "試験建設", unitPrice: 4500, orders: [], seats: { total: 0, used: 0, paid: 0 }, codes: [], courses, requests: {}, members: [], ticket: { contractId: "c1", total: 20000, expiring: 0, nextExpire: null } }));
});
await page.route("**/api/stripe/checkout", (route) => route.fulfill(json({ ok: false, reason: "未設定" }, 503)));
await page.goto(`${BASE}/order`);
await dismiss();
await page.getByTestId("order-ticket").waitFor({ timeout: 8000 });
check(/残り 20,000円/.test(await page.getByTestId("order-ticket").innerText()), "札に残高が出る");
check(await page.getByTestId("order-ticket").isDisabled(), "選んでいないうちは押せない");
/* 講座を選ぶ（押すと人数の欄が出る） */
await page.getByTestId("order-course-pick").first().click();
await page.getByTestId("order-seats-input").first().waitFor({ timeout: 4000 });
await page.getByTestId("order-seats-input").first().fill("2");
await page.waitForTimeout(150);
check(!(await page.getByTestId("order-ticket").isDisabled()), "2名なら押せる（9,000円 ≦ 20,000円）");
/* 足りないとき */
await page.getByTestId("order-seats-input").first().fill("5");
await page.waitForTimeout(150);
check(await page.getByTestId("order-ticket").isDisabled(), "5名（22,500円）は押せない");
check(/2,500円 足りません/.test(await page.getByTestId("order-ticket-short").innerText()), "足りない額が出る");
await page.getByTestId("order-seats-input").first().fill("2");
await page.waitForTimeout(150);
await page.getByTestId("order-ticket").click();
await page.getByTestId("ask-done-yes").waitFor({ timeout: 4000 });
const ob = await page.getByTestId("ask-done").innerText();
check(/9,000円（税抜）/.test(ob) && /残り 11,000円/.test(ob) && /請求書は出ません/.test(ob), `札に税抜と残りと「請求書は出ません」（${ob.replace(/\s+/g, " ")}）`);
await page.screenshot({ path: `${SC}/members-04-order-ticket.png` });
await confirmDone();
check(orderSent?.method === "ticket" && orderSent?.items?.[0]?.seats === 2, `送った中身（${JSON.stringify(orderSent)}）`);
console.log("OK: チケットで払う");

/* ── 営業パートナー：登録 → 承認待ち → 承認済み ── */
let partner = { ok: true, partner: null, url: "", bank: null, referrals: [], commissions: [], payouts: [], totals: null };
let pSent = null;
await page.route("**/api/partner", (route) => {
  if (route.request().method() === "POST") {
    pSent = JSON.parse(route.request().postData() ?? "{}");
    return route.fulfill(json({ ok: true, id: "sp1", code: "WXYZ6789" }));
  }
  return route.fulfill(json(partner));
});
await page.goto(`${BASE}/partner`);
await dismiss();
await page.getByTestId("partner-register").waitFor({ timeout: 8000 });
check(await page.getByTestId("partner-register").isDisabled(), "名前と連絡先が無いと押せない");
await page.getByTestId("partner-name").fill("紹介 花子");
await page.getByTestId("partner-contact").fill("090-0000-0000");
await page.getByTestId("partner-register").click();
partner = {
  ok: true,
  partner: { id: "sp1", name: "紹介 花子", kind: "individual", status: "pending", code: "WXYZ6789", rate: 30, contact: "090-0000-0000", approvedAt: null, createdAt: "2026-11-25T01:00:00Z" },
  url: "http://localhost:3100/ref?code=WXYZ6789", bank: null, referrals: [], commissions: [], payouts: [],
  totals: { confirmed: 0, paid: 0, expectedMonthly: 0, activeContracts: 0 },
};
await confirmDone();
check(pSent?.action === "register" && pSent?.name === "紹介 花子" && pSent?.kind === "individual", `送った中身（${JSON.stringify(pSent)}）`);
await page.getByTestId("partner-card").waitFor({ timeout: 8000 });
check(/承認待ち/.test(await page.getByTestId("partner-status").innerText()), "承認待ちと出る");
check((await page.getByTestId("partner-code").innerText()).trim() === "WXYZ6789", "紹介コードが出る");
check(/ref\?code=WXYZ6789/.test(await page.getByTestId("partner-url").innerText()), "紹介 URL が出る");
await page.screenshot({ path: `${SC}/members-05-partner.png` });
/* 確定と見込みが別に出る */
partner = {
  ...partner,
  partner: { ...partner.partner, status: "approved", approvedAt: "2026-11-25T02:00:00Z" },
  referrals: [{ companyId: "co1", company: "試験建設", source: "url", since: "2026-11-25T01:00:00Z", contract: { status: "active", plan: "スタンダード", monthlyFee: 10000, startedOn: "2026-11-01", nextDueOn: "2026-12-01", expectedMonthly: 3000 } }],
  commissions: [{ id: "cm1", company: "試験建設", periodMonth: "2026-11-01", baseNet: 10000, rate: 30, amount: 3000, kind: "earn", status: "confirmed", at: "2026-11-25T01:00:00Z" }],
  totals: { confirmed: 3000, paid: 0, expectedMonthly: 3000, activeContracts: 1 },
};
await page.goto(`${BASE}/partner`);
await dismiss();
await page.getByTestId("partner-totals").waitFor({ timeout: 8000 });
const tot = await page.getByTestId("partner-totals").innerText();
check(/確定（未払い）\s*3,000円/.test(tot) && /月あたり見込み\s*3,000円/.test(tot), `確定と見込みが別の欄（${tot.replace(/\s+/g, " ")}）`);
check(/試験建設/.test(await page.getByTestId("partner-referrals").innerText()), "紹介した会社が出る");
check(/10,000円 × 30%/.test(await page.getByTestId("partner-commissions").innerText()), "確定の根拠（税抜 × 率）が出る");
/* 振込先の登録 */
await page.getByTestId("partner-bank-edit").click();
await page.getByTestId("partner-bank-form").waitFor({ timeout: 4000 });
await page.getByTestId("partner-bank-bankName").fill("七十七銀行");
await page.getByTestId("partner-bank-branch").fill("名取支店");
await page.getByTestId("partner-bank-acctNo").fill("1234567");
await page.getByTestId("partner-bank-holder").fill("ショウカイ ハナコ");
await page.getByTestId("partner-bank-save").click();
await confirmDone();
check(pSent?.action === "bank" && pSent?.bankName === "七十七銀行" && pSent?.acctNo === "1234567", `振込先を送る（${JSON.stringify(pSent)}）`);
console.log("OK: 営業パートナー");

/* ── 本部：会員と報酬 ── */
let ownerSent = [];
await page.route("**/api/owner/orders", (route) => route.fulfill(json({ ok: true, orders: [], invoiceNo: "" })));
await page.route("**/api/owner/members", (route) => {
  if (route.request().method() === "POST") {
    ownerSent.push(JSON.parse(route.request().postData() ?? "{}"));
    return route.fulfill(json({ ok: true }));
  }
  return route.fulfill(json({
    ok: true, plans,
    contracts: [{
      id: "c1", companyId: "co1", company: "試験建設", kind: "member", status: "pending", method: "invoice", startedOn: null, endsOn: null, nextDueOn: null, note: "", createdAt: "2026-11-25T01:00:00Z",
      plan: plans[1], referrer: { id: "sp1", name: "紹介 花子", code: "WXYZ6789", locked: false }, balance: { total: 0, expiring: 0, nextExpire: null },
      payments: [{ id: "pay1", contractId: "c1", periodMonth: "2026-11-01", net: 10000, tax: 1000, amount: 11000, ticketAmount: 20000, method: "invoice", status: "pending", dueOn: "2026-11-01", invoicedAt: null, paidAt: null, refundedAt: null }],
    }],
    partners: [{ id: "sp1", userId: "u1", email: "h@x.jp", name: "紹介 花子", kind: "individual", status: "pending", code: "WXYZ6789", rate: 30, contact: "090", note: "", approvedAt: null, createdAt: "2026-11-25T01:00:00Z", contracts: 1, activeContracts: 0, confirmed: 0, paid: 0, expectedMonthly: 0 }],
    commissions: [], payouts: [],
    targets: { deadline: "2027-01-31", mrrMin: 500000, mrrGoal: 800000, netGoal: 500000, partnersGoal: 10, contractsGoal: 40 },
    dashboard: { mrr: 0, arr: 0, net: 0, expectedCommission: 0, activeContracts: 0, pendingContracts: 1, approvedPartners: 0, pendingPartners: 1, pendingPayments: 1, confirmedUnpaid: 0, paidCommissions: 0, cashIn: 0 },
    logs: [],
  }));
});
await page.goto(`${BASE}/owner`);
await dismiss();
await page.getByTestId("owner-tabs").waitFor({ timeout: 8000 });
const tabs = page.getByTestId("owner-tab");
const n = await tabs.count();
let found = false;
for (let i = 0; i < n; i++) if ((await tabs.nth(i).innerText()).includes("会員と報酬")) { await tabs.nth(i).click(); found = true; break; }
check(found, "本部に「会員と報酬」の札がある（MEMBERSHIP_ENABLED）");
await page.getByTestId("members-dash").waitFor({ timeout: 8000 });
check((await page.getByTestId("members-kpi").count()) === 4, "目標の進みが4本");
check(/800,000円/.test(await page.getByTestId("members-dash").innerText()), "MRR の目標が出る");
check((await page.getByTestId("members-payment").count()) === 1, "入金待ちが1件");
check((await page.getByTestId("members-invoice").getAttribute("href")) === "/invoice/member/pay1?owner=1", "請求書は本部の向きで開く");
await page.screenshot({ path: `${SC}/members-06-owner.png`, fullPage: true });
/* 入金を確認した → 確かめる札 → paid を送る */
await page.getByTestId("members-paid").click();
await page.getByTestId("ask-done-yes").waitFor({ timeout: 4000 });
const pb = await page.getByTestId("ask-done").innerText();
check(/11,000円/.test(pb) && /20,000円/.test(pb) && /紹介 花子/.test(pb), `札に税込・付与・紹介元（${pb.replace(/\s+/g, " ")}）`);
await confirmDone();
check(ownerSent.some((b) => b.action === "paid" && b.paymentId === "pay1"), `入金の確認を送る（${JSON.stringify(ownerSent)}）`);
/* パートナーの承認 */
await page.getByTestId("members-partner").first().click();
await page.getByTestId("members-partner-approve").waitFor({ timeout: 4000 });
await page.getByTestId("members-partner-approve").click();
await confirmDone();
check(ownerSent.some((b) => b.action === "partner_status" && b.status === "approved"), "承認を送る");
/* 紹介元の変更は理由なしでは送らない */
await page.getByTestId("members-contract").first().click();
await page.getByTestId("members-referrer").waitFor({ timeout: 4000 });
const before = ownerSent.length;
await page.getByTestId("members-referrer").locator("select").selectOption("none");
await page.waitForTimeout(200);
check(ownerSent.length === before && (await page.getByTestId("ask-done-yes").count()) === 0, "理由が無ければ紹介元を変える札が出ない");
console.log("OK: 本部の会員と報酬");

/* ── 制度を開けていない店の口（flag が無い振る舞いは unit test で見る。ここでは 404 の返事の出方）── */
await page.unroute("**/api/member/contract");
await page.route("**/api/member/contract", (route) => route.fulfill(json({ ok: false, reason: "準備中です。" }, 404)));
await page.goto(`${BASE}/member`);
await dismiss();
await page.getByTestId("member-ng").waitFor({ timeout: 8000 });
check(/準備中/.test(await page.getByTestId("member-ng").innerText()), "断られた理由が出る");

/* ── 規約と表記（制度を開けた店だけ条が足される） ── */
await page.goto(`${BASE}/legal/terms`);
await dismiss();
const terms = await page.getByTestId("terms").innerText();
check(/第5条/.test(terms) && /法人会員（月額プラン）とチケット/.test(terms) && /付与から6か月で失効/.test(terms), "規約に法人会員の条（6か月）");
check(/第6条/.test(terms) && /営業パートナー/.test(terms) && /30%/.test(terms), "規約に営業パートナーの条");
check(/第15条/.test(terms) && /準拠法/.test(terms), "あとの条番号がずれて最後は第15条");
await page.goto(`${BASE}/legal/tokushoho`);
await dismiss();
const tk = await page.getByTestId("tokushoho").innerText();
check(/法人会員（月額プラン）/.test(tk) && /付与から6か月有効/.test(tk) && /スタンダード/.test(tk), "特商法の表記に月額プランの欄");
console.log("OK: 規約と表記");

await browser.close();
if (ng) { console.error(`NG ${ng}件`); process.exit(1); }
console.log("ALL OK: 会員制度の画面");
