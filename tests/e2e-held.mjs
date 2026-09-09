/* 講座の一覧に「取得済」が付くか。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-held.mjs

   一覧は作り置きで、誰が見ても同じ。取得済みは人によって違うので、
   札が後から /api/me に聞いて付ける（src/components/HeldMark.tsx）。
   手元は Supabase につないでいないので、/api/me の返事だけ差し替える。

   見るのは
   ・取得済みの講座の札にだけ「取得済」が付くか
   ・/api/me が held を返さない（古い返事）ときに、何も付かず落ちないか */
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3100";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

let held = ["ashiba"];
await page.route("**/api/me", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true, userId: "u1", name: "持ってる 人", email: "", admin: false, owner: false,
      member: "active", needsJoin: false, canLearn: true, company: "まとめ工業", bills: [],
      ...(held ? { held } : {}),
    }),
  }),
);

const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};

/* **店によって、講座の一覧が畳んである。**
   特別教育ドットコムは73講座を平らに並べる店なので、ホームも「受ける講座」も
   押して開く形（CourseDrawer）。足場屋革命は足場・職長が開いたまま並ぶ。
   どちらの店でも同じ札（CourseCard）を見たいので、畳んである所は開けてから数える */
const openAll = async () => {
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => { d.open = true; });
  });
  await page.waitForTimeout(200);
};

/* ── 講座の一覧（/edu） ── */
await page.goto(`${BASE}/edu`);
await dismiss();
await openAll();
await page.waitForSelector('[data-testid="course-card"]', { timeout: 8000 });
await page.waitForTimeout(600);
{
  const marks = page.getByTestId("course-held");
  check((await marks.count()) === 1, `取得済みの講座にだけ付く（${await marks.count()}）`);
  const card = page.locator('[data-testid="course-card"]', { has: page.getByTestId("course-held") });
  const t = await card.first().innerText();
  check(t.includes("足場"), `付いた札が足場（${t.split("\n")[1]}）`);
  check(t.replace(/\s/g, "").includes("取得済"), "文字は「取得済」");
  console.log("OK: /edu の一覧に取得済が付く");
}

/* ── ホーム ── */
await page.goto(`${BASE}/`);
await dismiss();
await openAll();
await page.waitForTimeout(800);
{
  const n = await page.getByTestId("course-held").count();
  check(n >= 1, `ホームの札にも付く（${n}）`);
  console.log("OK: ホームにも取得済が付く");
}

/* ── 古い返事（held が無い）でも落ちない ── */
held = null;
await page.evaluate(() => { try { localStorage.removeItem("ashiba.me"); } catch {} });
await page.goto(`${BASE}/edu`);
await dismiss();
await openAll();
await page.waitForSelector('[data-testid="course-card"]', { timeout: 8000 });
await page.waitForTimeout(600);
check((await page.getByTestId("course-held").count()) === 0, "held が無ければ何も付かない");
console.log("OK: 古い返事でも落ちない");

await browser.close();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
