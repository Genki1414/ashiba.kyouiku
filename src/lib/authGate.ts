/* ログインを求めない道。middleware から使う。

   ・ログインの画面そのもの
   ・メールの確認リンクの戻り先
   ・圏外のときに出す1枚と、ホーム画面に追加するための書き
   ・つながり具合を見る /api/health（設定を直すときに開けないと困る）
   ・画面を動かす部品（/_next/ と、拡張子で分かるもの） */

const OPEN = [
  "/login",
  "/auth",
  "/offline.html",
  "/api/health",
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
