/* 全ての画面を、狭い端末で一度ずつ開く。
   実行: npm run dev -- -p 3100 && node tests/e2e-all-routes.mjs

   1画面ずつ見る検証は各 e2e にあるが、
   **どこか1つが真っ白／横にはみ出す／JSが落ちる**のは、
   その画面の検証を書いていない所で起きる。
   だからリリース前に、道のある画面を全部一度開く。

   見るのは4つだけ。
   ・返事が200で返るか（500・404を出していないか）
   ・JSが落ちていないか（pageerror）
   ・横にはみ出していないか（iPhone SE の 375px で横に振れると読めない）
   ・中身が入っているか（真っ白でないか）

   ログインしている人として見る（/api/me を差し替える）。
   講座の要る画面は、足場の講座で見る。 */
import { chromium } from "playwright-core";

const URL = process.env.BASE ?? "http://127.0.0.1:3100";
const EXE = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let ng = 0, okn = 0;
const t = (c, m) => { if (c) { okn++; console.log("  OK:", m); } else { ng++; console.error("  NG:", m); } };

const ME = {
  ok: true, userId: "u1", name: "中川 元基", email: "n@x",
  admin: true, owner: true, needsJoin: false, canLearn: true,
  courses: 1, company: "東北三上機材株式会社",
};

/* 講座が要る画面は、いちばん古い足場の講座で見る */
const C = "ashiba";
const ROUTES = [
  "/", "/edu", "/join", "/me", "/order", "/setup", "/updates", "/verify",
  "/admin", "/admin/check", "/owner",
  "/login", "/login/new",
  "/legal/privacy", "/legal/terms", "/legal/tokushoho",
  "/train", "/training", "/training/catalog", "/training/note",
  "/training/ch1", "/training/ch2", "/training/ch3",
  "/training/demo", "/training/demo/ch2", "/training/demo/ch3",
  `/edu/${C}`, `/edu/${C}/prep`, `/edu/${C}/exam`, `/edu/${C}/cert`,
  `/edu/${C}/talk`, `/edu/${C}/drill`, `/edu/${C}/1-1`,
  /* 打ち間違い・古いお気に入り。ここも日本語の画面が出ること */
  "/こんな画面は無い", "/edu/こんな講座は無い", `/edu/${C}/9-9`,
];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
await page.route("**/api/me", (r) => r.fulfill({ json: ME }));

let errs = [];
page.on("pageerror", (e) => errs.push(e.message));

for (const path of ROUTES) {
  errs = [];
  let status = 0;
  try {
    const res = await page.goto(URL + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    status = res?.status() ?? 0;
  } catch (e) {
    t(false, `${path} … 開けない（${e.message.split("\n")[0]}）`);
    continue;
  }
  const d = page.getByTestId("update-close");
  await d.waitFor({ timeout: 2000 }).catch(() => {});
  if (await d.count()) { await d.click().catch(() => {}); await page.waitForTimeout(200); }
  /* サーバに聞きに行く画面があるので、返事を待ってから見る。
     短く切ると、読み込み中の空っぽを「真っ白」と読み違える */
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);

  const m = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    len: (document.body.innerText || "").trim().length,
    jp: !!document.querySelector('[data-testid="notfound"]'),
  }));
  const over = m.w - m.cw;
  const bad = [];
  if (status >= 500) bad.push(`返事 ${status}`);
  if (errs.length) bad.push(`JSが落ちた（${errs[0].slice(0, 60)}）`);
  if (over > 2) bad.push(`横に ${over}px はみ出す`);
  if (m.len < 20) bad.push(`中身がほとんど無い（${m.len}字）`);
  if (status === 404 && !m.jp) bad.push("404 が英語の既定のまま（日本語の画面が要る）");
  t(bad.length === 0, `${path.padEnd(24)} 返事${status} 文字${String(m.len).padStart(5)} はみ出し${over}px` + (bad.length ? " … " + bad.join("／") : ""));
}

await browser.close();
console.log(ng === 0 ? `\nOK: ${okn}画面、どれも開く` : `\nNG: ${ng}画面 だめ ／ ${okn}画面 通過`);
process.exit(ng ? 1 : 0);
