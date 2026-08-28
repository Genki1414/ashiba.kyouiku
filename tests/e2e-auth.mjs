/* ログインの見張りのE2E。
   Supabase を設定した状態を作って、ログインしていない人が中へ入れないことを見る。
   本物の Supabase は無いので、繋ぎ先は嘘の値。
   「入れない」ことと「ログイン画面が出る」ことを確かめるにはこれで足りる。

   NEXT_PUBLIC_* は本番の作りだと組み立て時に埋め込まれるので、
   この試験は開発の作り（next dev）で動かす。

   実行: node tests/e2e-auth.mjs */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";

const PORT = 3310;
const BASE = `http://localhost:${PORT}`;
const SC = process.env.SC ?? ".";
let ng = 0;
const check = (c, m) => { if (!c) { console.error("NG:", m); ng++; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Supabase を設定した状態のサーバを立てる。
   他の試験と組み立て物がぶつからないよう、置き場所（distDir）を分ける。
   同じ .next を2台で共有すると片方が壊れ、あとの試験が落ちる。 */
const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  stdio: "ignore",
  detached: true,
  env: {
    ...process.env,
    NEXT_DIST_DIR: ".next-auth-test",
    NEXT_PUBLIC_SUPABASE_URL: "https://fake-abcdefgh.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-key-for-test",
  },
});
const stop = () => { try { process.kill(-server.pid, "SIGKILL"); } catch { /* もう落ちている */ } };
process.on("exit", stop);

let up = false;
for (let i = 0; i < 90; i++) {
  try { if ((await fetch(BASE + "/login")).ok) { up = true; break; } } catch { /* まだ */ }
  await sleep(1000);
}
if (!up) { console.error("NG: サーバが立たない"); process.exit(1); }

/* ── 入れない道 ── */
/* /setup はここに入れない。**開けないと困るのは、まさにログインできないとき**。
   映しているのは /api/health の中身だけで、その health は前から開いている */
const shut = ["/", "/training", "/training/ch1", "/edu", "/edu/ashiba", "/edu/ashiba/1-1", "/edu/ashiba/exam", "/updates"];
for (const u of shut) {
  const r = await fetch(BASE + u, { redirect: "manual" });
  check(r.status === 307 || r.status === 302, `${u} は素通しにならない（${r.status}）`);
  const loc = r.headers.get("location") ?? "";
  check(loc.includes("/login"), `${u} はログイン画面へ送られる`);
  check(loc.includes("next="), `${u} は元の画面を覚えている`);
}
console.log("OK: ログインしていないと中へ入れない");

/* ── ログインできないときに開く道 ── */
for (const u of ["/setup", "/login/new"]) {
  const r = await fetch(BASE + u, { redirect: "manual" });
  check(r.status === 200, `${u} はログイン無しで開ける（${r.status}）`);
}
/* 開けたところで、鍵が出ていないこと */
{
  const h = await (await fetch(BASE + "/api/health")).json();
  const raw = JSON.stringify(h);
  check(!/service_role|eyJ[A-Za-z0-9_-]{20}/.test(raw), "つながり具合に鍵は出ない");
  check(h?.auth?.email == null, "ログインしていなければ、メールは出ない");
  check(h?.auth?.admin !== true, "ログインしていなければ、担当者にはならない");
}
console.log("OK: 設定と合言葉の直し道は、ログイン無しで開ける");

/* ── 通す道 ── */
for (const u of ["/login", "/api/health", "/offline.html", "/icon-192.png", "/manifest.webmanifest"]) {
  const r = await fetch(BASE + u, { redirect: "manual" });
  check(r.status === 200, `${u} はログイン前でも開ける（${r.status}）`);
}
console.log("OK: ログイン画面と圏外の1枚は開ける");

/* ── 記録の取りに行きは、断りだと分かる形で返す ── */
for (const u of ["/api/progress?lessonId=1-1", "/api/quiz"]) {
  const r = await fetch(BASE + u, { redirect: "manual" });
  check(r.status === 401, `${u} は401（${r.status}）`);
  const j = await r.json().catch(() => null);
  check(j?.mode === "local", `${u} は端末内へ切り替えろと返す`);
}
console.log("OK: 取りに行きは401で返る");

/* ── ログイン画面 ── */
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => { console.error("NG: pageerror", e.message); ng++; });

await page.goto(BASE + "/training");
await page.waitForSelector('[data-testid="login"]', { timeout: 15000 })
  .catch(() => check(false, "ログイン画面が出る"));
check(page.url().includes("next=%2Ftraining"), "元いた画面を覚えている");
check(
  (await page.getByTestId("update-notice").count()) === 0,
  "更新のお知らせがログインの邪魔をしない",
);
await page.screenshot({ path: `${SC}/auth-01-login.png` });

/* 入れ忘れ */
await page.getByTestId("login-go").click();
await page.waitForTimeout(300);
check(
  (await page.getByTestId("login-error").textContent()).includes("入れてください"),
  "空のまま押すと知らせる",
);

/* はじめて使う */
await page.getByTestId("login-switch").click();
await page.waitForTimeout(300);
check((await page.getByTestId("login-name").count()) === 1, "はじめての人には氏名を聞く");
await page.getByTestId("login-email").fill("taro@example.com");
await page.getByTestId("login-pw").fill("abc123");
await page.getByTestId("login-go").click();
await page.waitForTimeout(300);
check(
  (await page.getByTestId("login-error").textContent()).includes("氏名"),
  "氏名が無ければ知らせる",
);
await page.getByTestId("login-name").fill("足場 太郎");
await page.getByTestId("login-go").click();
await page.waitForTimeout(300);
check(
  (await page.getByTestId("login-error").textContent()).includes("8文字以上"),
  "短い合言葉は知らせる",
);
await page.screenshot({ path: `${SC}/auth-02-signup.png` });

/* 繋がらないときも、英語のまま出さない */
await page.getByTestId("login-pw").fill("kotobade12");
await page.getByTestId("login-go").click();
await page.waitForTimeout(5000);
const msg = await page.getByTestId("login-error").textContent();
check(msg.includes("つながりませんでした"), `繋がらないときも日本語で返す（${msg.slice(0, 40)}）`);
/* Supabase の英語の言い分をそのまま出していないか
   （固有名詞の Supabase は出てよい） */
check(
  !/Failed to fetch|Invalid login|disabled|Database error/i.test(msg),
  `英語の言い分をそのまま出していない（${msg.slice(0, 40)}）`,
);
console.log("OK: ログイン画面が使える");

await browser.close();
stop();
if (ng) { console.error(`\n${ng} 件失敗`); process.exit(1); }
console.log("ALL OK");
