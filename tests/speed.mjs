/* 画面から画面への移りを測る。製品ビルドのサーバに当てる。
   押してから、次の画面の中身が出るまでを測る（同じ道を3回、いちばん速い回） */
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3210";
const EXE = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.route("**/api/me", (r) => r.fulfill({ json: {
  ok: true, userId: "u1", name: "中川 元基", email: "n@x", admin: true, owner: true,
  needsJoin: false, canLearn: true, member: "active", company: "東北三上機材株式会社",
  bills: [], held: [], owned: ["ashiba"], learning: [] } }));
const dismiss = async () => {
  const b = page.getByTestId("update-close");
  if (await b.count()) await b.click().catch(() => {});
};
const runs = [
  ["ホーム → 講座の一覧", "/", '[data-testid="course-list"]', 'a[href="/edu"]'],
  ["講座の一覧 → ホーム", "/edu", '[data-testid="home-course"], [data-testid="course-drawer"]', 'a[href="/"]'],
  ["ホーム → マイページ", "/", '[data-testid="me"], main', 'a[href="/me"]'],
  ["ホーム → 受講管理", "/", "text=受講管理", 'a[href="/admin"]'],
];
for (const [name, from, wait, link] of runs) {
  const ms = [];
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}${from}`, { waitUntil: "load" });
    await dismiss();
    await page.waitForTimeout(400);
    const a = page.locator(link).first();
    if (!(await a.count())) { ms.push(-1); break; }
    const t0 = Date.now();
    await a.click();
    await page.waitForSelector(wait, { timeout: 15000 }).catch(() => {});
    ms.push(Date.now() - t0);
  }
  const best = Math.min(...ms.filter((v) => v > 0));
  console.log(`${name.padEnd(24)} ${Number.isFinite(best) ? best + "ms" : "測れず"}   （3回 ${ms.join("/")}）`);
}
await browser.close();
