/* 請求書の一覧と、請求書の印刷（1枚に収まるか）。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-invoices.mjs

   ── なぜ差し替えるか ──
   手元は Supabase につないでいないので、口（/api/invoices、/api/owner/invoice）の
   返事だけ差し替える。見たいのは画面の作りと、紙にしたときの形。

   ── 何を見るか ──
   ・1回の申込み（3講座）が1件で出て、明細と合計が出るか
   ・**発行済みだけ「請求書を開く」が出て、未発行はそう言うか**
   ・払ったあと（入金済み）の請求書も、一覧から開けるか
   ・請求書を紙にしたとき、**1枚に収まる**か（げんきさんの実機では2枚に割れた） */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

await page.route("**/api/invoices", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      admin: true,
      list: [
        /* 入金済み・発行済み。払ったあとも開けること */
        { id: "o1", groupId: "g1", createdAt: "2026-09-01T00:00:00Z", method: "invoice", status: "paid",
          seats: 7, amount: 42900,
          items: [
            { courseId: "ashiba", short: "足場", seats: 3, amount: 23100 },
            { courseId: "harness", short: "フルハーネス", seats: 3, amount: 14850 },
            { courseId: "ishiwata", short: "石綿", seats: 1, amount: 4950 },
          ],
          invoicedAt: "2026-09-02T00:00:00Z", paidAt: "2026-09-05T00:00:00Z" },
        /* 入金待ち・未発行 */
        { id: "o2", groupId: "g2", createdAt: "2026-09-08T00:00:00Z", method: "invoice", status: "pending",
          seats: 2, amount: 9900, items: [{ courseId: "ashiba", short: "足場", seats: 2, amount: 9900 }],
          invoicedAt: null, paidAt: null },
        /* カード払い。請求書は無い */
        { id: "o3", groupId: "g3", createdAt: "2026-09-09T00:00:00Z", method: "card", status: "paid",
          seats: 1, amount: 4950, items: [{ courseId: "ashiba", short: "足場", seats: 1, amount: 4950 }],
          invoicedAt: null, paidAt: "2026-09-09T00:00:00Z" },
      ],
    }),
  }),
);
await page.route("**/api/owner/invoice**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      order: {
        id: "o1", no: "INV-20260902-0001", to: "まとめ工業株式会社", addr: "青森県八戸市○○ 1-2-3",
        what: "特別教育 受講コード",
        items: [
          { what: "足場の組立て等の業務に係る特別教育 受講コード", qty: 3, unit: 7000, net: 21000, tax: 2100, amount: 23100 },
          { what: "フルハーネス型墜落制止用器具 特別教育 受講コード", qty: 3, unit: 4500, net: 13500, tax: 1350, amount: 14850 },
          { what: "石綿使用建築物等解体等業務に係る特別教育 受講コード", qty: 1, unit: 4500, net: 4500, tax: 450, amount: 4950 },
        ],
        qty: 7, unit: 4500, net: 39000, tax: 3900, amount: 42900, taxRate: 0.1,
        due: null, at: "2026-09-02T00:00:00Z", invoicedAt: "2026-09-02T00:00:00Z",
        paidAt: "2026-09-05T00:00:00Z", status: "paid", note: "", solo: false,
      },
      seller: {
        name: "見本商店", ceo: "見本 太郎", address: "青森県八戸市△△ 4-5-6", tel: "0178-00-0000",
        email: "example@example.com", invoiceNo: "T0000000000000",
        bank: { name: "見本銀行", branch: "本店", kind: "普通", no: "0000000", holder: "ミホンショウテン" },
      },
    }),
  }),
);

const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};

/* ── 一覧 ── */
await page.goto(`${BASE}/invoices`);
await dismiss();
await page.waitForSelector('[data-testid="invoice-row"]', { timeout: 8000 });
{
  const rows = page.getByTestId("invoice-row");
  check((await rows.count()) === 3, `申込みごとに1件（${await rows.count()}）`);
  /* 並びは API が決める（新しい申込みが先。groupInvoices）。ここでは中身で探す */
  const card = (await rows.filter({ hasText: "カード払い" }).first().innerText()).replace(/\s/g, "");
  check(card.includes("請求書はありません"), `カード払いには請求書が無いと出る（${card.slice(0, 40)}）`);
  const paid = (await rows.filter({ hasText: "42,900" }).first().innerText()).replace(/\s/g, "");
  check(paid.includes("足場3名") && paid.includes("フルハーネス3名") && paid.includes("石綿1名"), "明細が講座ごとに出る");
  check(paid.includes("42,900"), "合計が出る");
  check(paid.includes("入金済み"), "入金済みと出る");
  /* **払ったあとも開ける**。ここが無かったのが依頼の元 */
  const opens = page.getByTestId("invoice-row-open");
  check((await opens.count()) === 1, `発行済みにだけ「請求書を開く」が出る（${await opens.count()}）`);
  check((await opens.first().getAttribute("href")) === "/invoice/o1", "開く先は、その申込みの請求書");
  const waits = page.getByTestId("invoice-row-wait");
  check((await waits.count()) === 1, "未発行は「まだ発行されていません」と出る");
  console.log("OK: 請求書の一覧に、払ったあとの請求書も残る");
}

/* ── 請求書を紙にしたとき、1枚に収まるか ── */
await page.goto(`${BASE}/invoice/o1`);
await dismiss();
await page.waitForSelector('[data-testid="invoice"]', { timeout: 8000 });
{
  check((await page.getByTestId("invoice-list-link").count()) === 1, "買った側の請求書から一覧へ戻れる");
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  /* PDF の頁数。/Type /Page（/Pages ではない）を数える */
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check(pages === 1, `請求書は1枚に収まる（${pages}枚）`);
  /* 白地になっているか（外枠の黒地が残っていないか） */
  const bg = await page.evaluate(() => {
    const shell = document.querySelector(".shell");
    return {
      html: getComputedStyle(document.documentElement).backgroundColor,
      shell: shell ? getComputedStyle(shell).backgroundColor : "",
      shellMax: shell ? getComputedStyle(shell).maxWidth : "",
      tape: [...document.querySelectorAll(".tape, .noprint")].every((el) => getComputedStyle(el).display === "none"),
    };
  });
  check(bg.html === "rgb(255, 255, 255)", `紙は白地（${bg.html}）`);
  check(bg.shell === "rgb(255, 255, 255)" && bg.shellMax === "none", `外枠の黒地と細い幅を外している（${bg.shell} / ${bg.shellMax}）`);
  check(bg.tape, "テープと操作の行は紙に出ない");
  await page.emulateMedia({ media: "screen" });
  console.log("OK: 請求書は白地で1枚に収まる");
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
