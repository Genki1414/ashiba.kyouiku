/* ホームの出方。
   実行: npm run dev -- -p 3100 && node tests/e2e-home-fast.mjs

   特別教育と実務トレーニングは作り置きなので、押した瞬間に出る。
   ところが名前と立場はサーバに聞きに行くので、そこだけ後から出てくる。
   現場で何度も開くものなので、その一拍がストレスになる。

   ここで見るのは、
   ・1回目：帯の高さが先に取ってあり、下がずり下がらないこと
   ・2回目：覚えているぶんで、聞き終わる前に出ていること
   ・帯と札で、聞きに行くのが1本で済んでいること */

import { chromium } from "playwright-core";

const URL = process.env.BASE ?? "http://127.0.0.1:3100";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let ng = 0;
const check = (c, m) => { if (c) console.log("  OK:", m); else { ng++; console.error("  NG:", m); } };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

/* この検証は Supabase 抜きで動かす。返事だけ差し替えて、
   遅い回線でも画面がどう出るかを見る */
const ME = {
  ok: true, userId: "u1", name: "中川 元基", email: "n@x",
  admin: true, owner: false, needsJoin: false, canLearn: true,
  courses: 1, company: "東北三上機材株式会社",
};
let asked = 0;
let loads = 0;
let answeredAt = 0;
page.on("load", () => { loads++; });

/* 電波の悪い現場のつもりで、わざと遅らせる。
   手元の開発サーバは画面を組み立てるのに1秒近くかかるので、
   それより長くしておく（本番はもっと速い） */
const SLOW = 3000;
await page.route("**/api/me", async (r) => {
  asked++;
  await new Promise((ok) => setTimeout(ok, SLOW));
  answeredAt = Date.now();
  await r.fulfill({ json: ME });
});

const dismiss = async () => {
  const b = page.getByRole("button", { name: "分かった" });
  if (await b.count()) await b.first().click().catch(() => {});
};

console.log("── 1回目（まだ何も覚えていない）──");
await page.goto(URL, { waitUntil: "domcontentloaded" });
await dismiss();

/* 作り置きのぶんは、聞き終わる前に出ている */
await page.waitForSelector("text=実務トレーニング", { timeout: 5000 });
const early = await page.getByTestId("home-course").count();
check(early >= 1, `特別教育の札が、聞き終わる前に出ている（${early}件）`);

/* 帯の高さは先に取ってある。取っていないと、あとから出たときに全部ずり下がる */
const hold = await page.getByTestId("account-bar-hold").count();
const bar = await page.getByTestId("account-bar").count();
check(hold + bar === 1, `帯の場所は先に取ってある（受け ${hold}／本物 ${bar}）`);

const before = await page.getByTestId("home-course").first().boundingBox();
await page.waitForSelector('[data-testid="home-admin"]', { timeout: 15000 });
const after = await page.getByTestId("home-course").first().boundingBox();
check(
  Math.abs((before?.y ?? 0) - (after?.y ?? 0)) < 2,
  `名前が出ても、特別教育の札がずれない（${Math.round(before?.y ?? 0)} → ${Math.round(after?.y ?? 0)}）`,
);
check(asked === 1, `帯と札で、聞きに行くのは1本（いま ${asked}本）`);

/* はじめて使う端末で読み直しが挟まると、ログインして最初に
   ホームを開くたびに一拍おかれる。消すものが無いのだから、読み直さない */
check(loads === 1, `はじめての端末でも、読み直しが挟まらない（読み込み ${loads}回）`);
const owner = await page.evaluate(() => localStorage.getItem("ashiba.owner"));
check(owner === "u1", `それでも端末の持ち主は覚える（${owner}）`);

console.log("── 2回目（覚えている）──");
asked = 0;
answeredAt = 0;
const t0 = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await dismiss();

/* 返事より先に出ていれば、覚えているぶんで描けている
   （サーバを待っていない）。時計の速さに左右されない見方 */
await page.waitForSelector('[data-testid="home-admin"]', { timeout: 15000 });
const cardAt = Date.now();
check(
  answeredAt === 0 || cardAt < answeredAt,
  `教育担当者の札が、返事より先に出る（札 ${cardAt - t0}ms／返事 ${answeredAt ? answeredAt - t0 : "まだ"}ms）`,
);
const quickBar = await page.getByTestId("account-bar").count();
check(quickBar === 1, "名前も、聞き終わる前に出ている");
const nm = await page.getByTestId("account-name").innerText();
check(nm.includes("中川"), `覚えていた名前が出る（${nm}）`);

/* 2回目も、聞きに行くのは1本 */
await page.waitForTimeout(SLOW + 600);
check(asked === 1, `2回目も、聞きに行くのは1本（いま ${asked}本）`);

await page.screenshot({ path: "/tmp/home-fast.png", fullPage: true });

console.log("── 人が変わったら、消して読み直す ──");
await page.evaluate(() => localStorage.setItem("ashiba.owner", "べつのひと"));
await page.evaluate(() => localStorage.setItem("ashiba.watched", "まえのひとの記録"));
loads = 0;
await page.goto(URL, { waitUntil: "domcontentloaded" });
/* 人が変わると、端末の記録を消して読み直す（読み直しがもう1往復ぶん） */
await page.waitForTimeout(SLOW * 2 + 2000);
const kept = await page.evaluate(() => localStorage.getItem("ashiba.me"));
const owner2 = await page.evaluate(() => localStorage.getItem("ashiba.owner"));
const gone = await page.evaluate(() => localStorage.getItem("ashiba.watched"));
check(owner2 === "u1", `端末の持ち主が入れ替わる（${owner2}）`);
check(gone === null, "前の人の記録は消える");
check(loads >= 2, `人が変わったときは読み直す（読み込み ${loads}回）`);
check(!!kept, "入れ替わったあとは、新しい人のぶんを覚え直している");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
