/* ログインを求めない道。middleware から使う。

   ・ログインの画面そのもの
   ・メールの確認リンクの戻り先
   ・圏外のときに出す1枚と、ホーム画面に追加するための書き
   ・つながり具合を見る /api/health と、それを映す /setup。
     **開けないと困るのは、まさにログインできないとき**。
     health を開けておきながら /setup を閉じていたので、
     設定を直したい人が中身を見られなかった。
     出るのは health が返すものだけ（鍵は返らない。メールは本人のもの）
   ・修了証の照会（/verify）。元請や監督署が番号を確かめるので、
     こちらのログインを持っていない人が開く。名前は伏せ字にしてある
   ・Stripe からの入金の知らせ（/api/stripe/webhook）。
     向こうはログインを持たない。代わりに署名を確かめる
   ・特商法の表記・利用規約・個人情報の扱い（/legal/…）。
     買う前に、まだ登録していない人が読むもの
   ・画面を動かす部品（/_next/ と、拡張子で分かるもの） */

const OPEN = [
  "/login",
  "/setup",
  "/auth",
  "/offline.html",
  "/api/health",
  "/verify",
  "/api/verify-cert",
  "/api/stripe/webhook",
  "/legal",
  "/manifest.webmanifest",
  "/sw.js",
];

const ASSET = /\.(png|jpe?g|gif|ico|svg|webmanifest|txt|xml|json|js|css|map|woff2?|mp3|wav)$/i;

/** その道は、ログインしていなくても通せるか */
export function isOpenPath(p: string): boolean {
  if (p.startsWith("/_next/")) return true;
  if (ASSET.test(p)) return true;
  return OPEN.some((o) => p === o || p.startsWith(o + "/"));
}

export { OPEN as OPEN_PATHS };
