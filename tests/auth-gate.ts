/* ログインを求める道・求めない道の切り分けのテスト。
   ここを間違えると、ログイン画面が開けない（何もできない）か、
   逆に中身が素通しになる。
   実行: npm run test:authgate */

import { OPEN_PATHS, isOpenPath } from "../src/lib/authGate";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}`); }
};

/* ── 通す道 ── */
const open = [
  "/login",
  "/login?next=/edu",          // 問い合わせは道に含まれない想定だが、念のため素で
  "/auth/confirm",
  "/offline.html",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
  "/verify",
  "/api/verify-cert",
  "/icon-192.png",
  "/apple-touch-icon.png",
  "/_next/static/chunks/main.js",
  "/_next/image?url=x",
  "/favicon.ico",
];
for (const p of open) check(isOpenPath(p.split("?")[0]), `通す: ${p}`);

/* ── 止める道 ── */
const shut = [
  "/",
  "/edu",
  "/edu/1-1",
  "/edu/exam",
  "/edu/prep",
  "/training",
  "/training/ch1",
  "/training/note",
  "/updates",
  "/setup",
  "/api/progress",
  "/api/quiz",
  "/api/exam",
  "/api/enrollment",
  "/api/verify-log",
  "/api/cert",
  "/edu/cert",
];
for (const p of shut) check(!isOpenPath(p), `止める: ${p}`);

/* ── 紛らわしいもの ── */
check(!isOpenPath("/loginish"), "/loginish は /login ではない");
check(!isOpenPath("/api/healthy"), "/api/healthy は /api/health ではない");
check(!isOpenPath("/api/verify-log"), "/api/verify-log（顔照合のログ）は通さない");
check(isOpenPath("/api/verify-cert"), "/api/verify-cert（修了証の照会）は通す");
check(!isOpenPath("/api/cert"), "/api/cert（修了証の発行）は本人だけ");
check(isOpenPath("/login/reset"), "/login の下は通す");
check(!isOpenPath("/edu/1-1/js"), "拡張子に見えても道の一部なら止める");
check(isOpenPath("/edu/fig.png"), "画像は通す");

/* ── 記録に関わる道が開いていないか（いちばん怖い取り違え）── */
for (const p of ["/api/progress", "/api/exam", "/api/enrollment", "/api/cert", "/api/verify-log"]) {
  check(!OPEN_PATHS.includes(p), `${p} が通す一覧に入っていない`);
}
check(OPEN_PATHS.includes("/login"), "/login は通す一覧にある");
check(OPEN_PATHS.includes("/api/health"), "/api/health は通す一覧にある（設定を直すときに要る）");

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
