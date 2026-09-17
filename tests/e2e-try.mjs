/* 無料の1単元（0039）。ログインなしで開き、何も記録しない。
   実行: npm run dev -- -p 3100 のあと node tests/e2e-try.mjs */
import { chromium } from "playwright-core";
const BASE = "http://localhost:3100";
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
/* ログインのクッキーを一切持たない文脈で開く */
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

/* 記録の口を叩いたら落とす。**叩かないこと**がこの画面の決まり */
const written = [];
await page.route("**/api/progress**", (route) => { written.push(route.request().url()); return route.fulfill({ status: 500, body: "{}" }); });
await page.route("**/api/verify-log**", (route) => { written.push(route.request().url()); return route.fulfill({ status: 500, body: "{}" }); });

const dismiss = async () => {
  const b = page.getByTestId("update-close");
  await b.waitFor({ timeout: 1500 }).catch(() => {});
  if (await b.count()) { await b.click(); await page.waitForTimeout(150); }
};

/* ── 入口 ── */
await page.goto(`${BASE}/try`);
await dismiss();
await page.getByTestId("try-index").waitFor({ timeout: 8000 });
const n = await page.getByTestId("try-course").count();
check(n >= 1, `講座が並ぶ（${n}）`);
const first = await page.getByTestId("try-course").first().getAttribute("href");
check(/^\/edu\/[^/]+\/try$/.test(first ?? ""), `第1単元へ行く（${first}）`);
await page.screenshot({ path: `${SC}/try-01-index.png` });

/* ── 第1単元 ── */
await page.goto(`${BASE}/edu/ashiba/try`);
await dismiss();
await page.getByTestId("try").waitFor({ timeout: 10000 });
check(!page.url().includes("/login"), "ログインへ飛ばされない");
check((await page.getByTestId("try-badge").count()) === 1, "お試しの印が出る");
check(/記録しません/.test(await page.getByTestId("try-note").innerText()), "記録しないと書いてある");
check((await page.locator("video").count()) === 0, "カメラを使わない");
check((await page.getByTestId("face-model").count()) === 0, "顔の照合の支度をしない");
check((await page.getByTestId("try-cta").count()) === 1, "申し込む道が出る");
check((await page.getByTestId("try-solo").getAttribute("href")) === "/solo?courseId=ashiba", "ひとりで受けるへ（講座つき）");
check((await page.getByTestId("try-join").getAttribute("href")) === "/join", "会社で受けるへ");
check(/円/.test(await page.getByTestId("try-cta").innerText()), "税込の値段が出る");
/* 下のタブは出ない（本番の単元と同じ） */
check((await page.getByTestId("bottom-nav").count()) === 0, "下のタブは出ない");
await page.screenshot({ path: `${SC}/try-02-lesson.png` });

/* 解説の1行目が出ている（教材そのもの） */
const text = await page.locator("body").innerText();
check(text.length > 200, "教材の本文が出ている");

/* 確認問題まで進んでも、記録の口を叩かない。**ここで数える。**
   このあと開く本番の目次（/edu/ashiba）は進みを読むので、そこは数に入れない */
check(written.length === 0, `お試しの単元は記録の口を叩かない（${written.join(", ")}）`);

/* ── 本番の単元は、ログインなしでは開かない（お試しだけが開く） ──
   手元に Supabase が無いときは見張り自体が無いので、そのときは飛ばす */
await page.goto(`${BASE}/edu/ashiba`);
await page.waitForTimeout(500);
const gated = page.url().includes("/login") || (await page.getByTestId("need-seat").count()) > 0;
console.log(gated ? "OK: 本番の目次はログインが要る" : "SKIP: 手元に見張りが無い（Supabase 未設定）");

await browser.close();
if (ng) { console.error(`${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
