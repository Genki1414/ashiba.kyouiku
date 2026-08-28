/* ログインを求める道・求めない道の切り分けのテスト。
   ここを間違えると、ログイン画面が開けない（何もできない）か、
   逆に中身が素通しになる。
   実行: npm run test:authgate */

import { readFileSync } from "node:fs";
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
  "/api/progress",
  "/api/quiz",
  "/api/exam",
  "/api/enrollment",
  "/api/verify-log",
  "/api/cert",
  "/edu/cert",
  "/admin",
  "/api/admin/summary",
  "/api/admin/setup",
  "/api/admin/cert",
  "/api/admin/role",
  "/api/training",
  "/join",
  "/api/join",
  "/api/admin/company",
  "/api/me",
  "/order",
  "/api/order",
  "/owner",
  "/api/owner/orders",
  "/api/stripe/checkout",
];
for (const p of shut) check(!isOpenPath(p), `止める: ${p}`);

/* /setup はここから外した。
   前はログインが要る側に置いていたが、**開けないと困るのは
   まさにログインできないとき**で、そのとき開けなかった。
   出るのは /api/health が返すものだけで、その health は前から開いている。
   鍵は返らず、メールはログインしている本人のものしか出ない。 */

/* ── 紛らわしいもの ── */
check(!isOpenPath("/loginish"), "/loginish は /login ではない");
check(!isOpenPath("/api/healthy"), "/api/healthy は /api/health ではない");
check(!isOpenPath("/api/verify-log"), "/api/verify-log（顔照合のログ）は通さない");
check(isOpenPath("/api/verify-cert"), "/api/verify-cert（修了証の照会）は通す");
check(isOpenPath("/api/stripe/webhook"), "Stripe からの知らせは通す（ログインを持たない）");
check(isOpenPath("/legal/tokushoho"), "特商法の表記は、登録していない人も読める");
check(isOpenPath("/legal/terms"), "利用規約も読める");
check(isOpenPath("/legal/privacy"), "個人情報の扱いも読める");
check(!isOpenPath("/legalish"), "/legalish は /legal ではない");
check(!isOpenPath("/api/stripe/checkout"), "支払い画面を作る方は止める");
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

/* ── ログインできないときに、原因を見る道 ──
   /api/health を開けておきながら /setup を閉じていたので、
   ログインできない人が中身を見られなかった。
   開けないと困るのは、まさにログインできないとき */
check(isOpenPath("/setup"), "/setup はログイン無しで開ける");

/* ── 合言葉を決め直す道 ──
   その会社で唯一の教育担当者が忘れたら、頼む相手が居ない。
   ここが閉じていると、メールのリンクを踏んでも入れない */
check(isOpenPath("/login/new"), "合言葉の決め直しは、ログイン無しで開ける");
check(isOpenPath("/auth/confirm"), "メールのリンクの戻り先は開いている");

/* ── 見張りを通さないもの ──
   置いてあるだけのファイルまで見張ると、1本読むたびに
   Supabase の認証サーバまで往復する。
   顔検出の重み（public/models）は 6.5MB あって何本にも分かれているので、
   受講の画面を開くたびに、その回数だけ往復していた */
{
  const src = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
  const m = /matcher:\s*\[([^\]]*)\]/s.exec(src);
  const matcher = m?.[1] ?? "";
  for (const x of ["models/", "sfx/", "icons/", "sw.js", "manifest.webmanifest"]) {
    check(matcher.includes(x), `見張りを通さない: ${x}`);
  }
  check(matcher.includes("_next/static"), "作り置きの中身も通さない");

  /* 拡張子の付いたものは、まとめて外す（画像・音・地図など） */
  check(/\\\.\[a-z0-9\]\+\$/i.test(src), "拡張子の付いたものを外す決まりがある");

  /* ログインのクッキーが無ければ、聞きに行かずにその場で断る */
  check(/startsWith\("sb-"\)/.test(src), "クッキーが無ければ、聞きに行かない");
  /* 手元で確かめられる方（getClaims）を先に使い、
     getUser は使えなかったときの受け皿にする（注釈は数えない） */
  const calls = [...src.matchAll(/auth\.(getClaims|getUser)\(/g)].map((x) => x[1]);
  check(calls[0] === "getClaims", `getClaims を先に呼ぶ（${calls.join("→")}）`);
  check(calls.includes("getUser"), "getUser は受け皿として残す");
}

/* 誰かを見るのは、ひとつの取りに行きで1回だけ。
   /api/me は運営か・担当者か・受講できるかで3回呼んでいた */
{
  const src = readFileSync(new URL("../src/lib/supabase/session.ts", import.meta.url), "utf8");
  check(/cache\(/.test(src), "currentUser は取りに行きごとに1回だけ");
  check(/from "react"/.test(src), "React の cache を使う");
  check(/getClaims/.test(src), "getClaims を使う（往復が消える）");
}

/* ── 合言葉を忘れたときの道が、画面にあるか ──
   前は「教育担当者に連絡してください」としか書いていなかった。
   その担当者本人が忘れたら詰む */
{
  const src = readFileSync(new URL("../src/app/login/LoginClient.tsx", import.meta.url), "utf8");
  check(/resetPasswordForEmail/.test(src), "決め直しのメールを送れる");
  check(/login-forgot/.test(src), "「合言葉を忘れた」の入口がある");
  /* 登録の有無で出し分けると、誰が登録しているかを外から当てられる */
  check(/setMailed\(true\)/.test(src), "送れても送れなくても、同じ返事をする");
  check(/next=\/login\/new/.test(src), "戻り先は、決め直しの画面");

  const np = readFileSync(new URL("../src/app/login/new/NewPasswordClient.tsx", import.meta.url), "utf8");
  check(/updateUser\(\{ password/.test(np), "新しい合言葉を入れられる");
  /* リンクの期限切れ・別の端末。黙って失敗させない */
  check(/newpw-expired/.test(np), "リンクが使えないときは、そう言って送り直しへ戻す");
}

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);

/* ── 合言葉を忘れたときの道が、画面にあるか ──
   前は「教育担当者に連絡してください」としか書いていなかった。
   その担当者本人が忘れたら詰む */
{
  const src = readFileSync(new URL("../src/app/login/LoginClient.tsx", import.meta.url), "utf8");
  check(/resetPasswordForEmail/.test(src), "決め直しのメールを送れる");
  check(/login-forgot/.test(src), "「合言葉を忘れた」の入口がある");
  /* 登録の有無で出し分けると、誰が登録しているかを外から当てられる */
  check(/setMailed\(true\)/.test(src) && /finally/.test(src), "送れても送れなくても、同じ返事をする");
  check(/next=\/login\/new/.test(src), "戻り先は、決め直しの画面");

  const np = readFileSync(new URL("../src/app/login/new/NewPasswordClient.tsx", import.meta.url), "utf8");
  check(/updateUser\(\{ password/.test(np), "新しい合言葉を入れられる");
  /* リンクの期限切れ・別の端末。黙って失敗させない */
  check(/newpw-expired/.test(np), "リンクが使えないときは、そう言って送り直しへ戻す");
}

