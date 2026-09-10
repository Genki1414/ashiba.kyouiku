/* 画面の下の行き先（固定メニュー）と、お知らせの出し方。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-nav.mjs

   ── 何を見るか ──
   ・下の行き先が、どの画面にも出ているか
   ・**立場によって4つ目が変わるか**（担当者／本部）
   ・受講の邪魔になる画面（単元・実務トレーニング・ログイン）では出ないか
   ・**お知らせは、一度閉じたら二度と自分から出ないか**（げんきさん 2026-09-09） */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

let who = { ok: true, userId: "u1", name: "受講 太郎", email: "a@x.jp", admin: false, owner: false,
  member: "active", needsJoin: false, canLearn: true, company: "見本工業", bills: [], held: [] };
await page.route("**/api/me", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(who) }));

const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
};

/* ── お知らせは、自分からは出ない ── */
await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
{
  /* **画面をふさぐ知らせは出さない**（げんきさん 2026-09-09）。
     読みたいときは、ホームの下の入口から /updates を開く */
  check((await page.getByTestId("update-notice").count()) === 0, "知らせが画面をふさがない");
  const link = page.locator('a[href="/updates"]');
  check((await link.count()) >= 1, "ホームに「更新のお知らせ」の入口がある");
  await page.goto(`${BASE}/updates`);
  await page.waitForTimeout(400);
  const t = (await page.locator("body").innerText()).replace(/\s/g, "");
  check(t.includes("更新のお知らせ") || t.includes("更新"), "入口の先に、更新が並んでいる");
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(500);
  console.log("OK: 知らせは押しに行く形（画面をふさがない）");
}

/* ── 下の行き先 ── */
{
  const nav = page.getByTestId("bottom-nav");
  check((await nav.count()) === 1, "ホームに下の行き先が出る");
  const labels = (await page.getByTestId("bottom-nav-item").allInnerTexts()).map((t) => t.replace(/\s/g, ""));
  check(labels.length === 3, `受講者には3つ（${labels.join("・")}）`);
  check(labels.some((t) => t.includes("ホーム")) && labels.some((t) => t.includes("講座")) &&
        labels.some((t) => t.includes("マイページ")), `行き先の名前（${labels.join("・")}）`);
  /* **受講者に本部と担当者は出さない。**立場は /api/me がサーバで決める */
  check(!labels.some((t) => t.includes("運営")) && !labels.some((t) => t.includes("受講管理")),
    `受講者には運営も受講管理も出ない（${labels.join("・")}）`);
  await page.goto(`${BASE}/edu`);
  await page.waitForTimeout(300);
  check((await page.getByTestId("bottom-nav").count()) === 1, "講座の一覧にも出る");
  console.log("OK: 下の行き先が、どの画面にも出る");
}

/* ── 立場で4つ目が変わる ── */
{
  who = { ...who, admin: true };
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(500);
  let labels = (await page.getByTestId("bottom-nav-item").allInnerTexts()).map((t) => t.replace(/\s/g, ""));
  check(labels.some((t) => t.includes("受講管理")), `担当者には「受講管理」が出る（${labels.join("・")}）`);
  who = { ...who, owner: true };
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(500);
  labels = (await page.getByTestId("bottom-nav-item").allInnerTexts()).map((t) => t.replace(/\s/g, ""));
  check(labels.some((t) => t.includes("運営")) && !labels.some((t) => t.includes("受講管理")),
    `運営を兼ねる人には「運営」だけ（${labels.join("・")}）`);
  who = { ...who, admin: false, owner: false };
  console.log("OK: 立場によって行き先が変わる");
}

/* ── お知らせに、誰から届いたかが出る（げんきさん 2026-09-10）── */
{
  /* 会社の教育担当者からの返事と、運営からの返事が、同じ枠に並ぶ。
     **次に誰に聞けばいいか**が分からないと、動きようがない */
  const now = new Date().toISOString();
  await page.route("**/api/notices", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true, unread: 2,
      notices: [
        { id: "n1", kind: "given", t: "受講コードが届きました", d: "押すと開きます",
          href: "/edu/ashiba", from: "admin", note: "", at: now, read: false },
        { id: "n2", kind: "slot", t: "討議の候補日が出ました", d: "日を選んでください",
          href: "/edu/shokucho/cert", from: "owner", note: "", at: now, read: false },
      ],
    }) }));
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(700);
  await page.getByTestId("notices").waitFor({ timeout: 8000 });
  const froms = (await page.getByTestId("notice-from").allInnerTexts()).map((t) => t.trim());
  check(froms.length === 2, `1件ずつ差出人が出る（${froms.join("・")}）`);
  check(froms.includes("教育担当者"), `受講コードを配ったのは会社の担当者（${froms.join("・")}）`);
  check(froms.includes("運営"), `討議の日を出すのは運営（${froms.join("・")}）`);
  await page.unroute("**/api/notices");
  console.log("OK: お知らせに、誰から届いたかが出る");
}

/* ── ホームと下の札が重ならない（げんきさん 2026-09-10）── */
{
  /* 「ホームと下部タブで重複するものはホームに出さない」。
     同じ行き先が1画面に2つ並ぶと、どちらを押せばいいのか分からない */
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(600);
  check((await page.getByTestId("home-me").count()) === 0, "ホームにマイページの札が出ない");

  who = { ...who, admin: true };
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(600);
  check((await page.getByTestId("home-admin").count()) === 0,
    "担当者のホームに受講管理の札が出ない（下に出ている）");

  /* 兼ねている人の下の札は「運営」だけ。**受講管理はそこに無いので残す。**
     消すと、ホームから受講管理へ行く道が無くなる */
  who = { ...who, owner: true };
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(600);
  check((await page.getByTestId("home-owner").count()) === 0, "ホームに運営管理の札が出ない");
  check((await page.getByTestId("home-admin").count()) === 1,
    "兼ねている人には受講管理の札が残る（下は運営だけなので重ならない）");

  who = { ...who, admin: false, owner: false };
  console.log("OK: ホームと下の札が重ならない");
}

/* ── 受講の邪魔になる画面では出ない ── */
{
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(400);
  check((await page.getByTestId("bottom-nav").count()) === 0, "ログインでは出ない");
  await page.goto(`${BASE}/training`);
  await page.waitForTimeout(400);
  check((await page.getByTestId("bottom-nav").count()) === 0, "実務トレーニングでは出ない");
  await page.goto(`${BASE}/edu/ashiba/1`);
  await page.waitForTimeout(600);
  check((await page.getByTestId("bottom-nav").count()) === 0, "単元を見ている間は出ない");
  console.log("OK: 受講の邪魔になる画面では出ない");
}

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
