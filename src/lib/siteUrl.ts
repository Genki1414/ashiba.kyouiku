/* この仕組みの本番の住所。

   なぜ要るか。
   合言葉の決め直しは、メールのリンクで戻ってくる。
   その戻り先は Supabase の許した住所の中に無いと弾かれる。
   ところが Vercel は配信のたびに違う住所も配るので、
   そちらで開いた画面から送ると、戻り先が許した住所と合わない。

   だから戻り先は**決め打ち**にする。
   いまは仮で、いまの住所を書いてある。
   独自ドメインにしたら、ここと Supabase の許した住所の両方を変える。

   NEXT_PUBLIC_SITE_URL を入れれば、そちらが勝つ。
   （NEXT_PUBLIC_ が付くのは、画面から読むため。
     ここに入るのは公開している住所なので、隠す必要は無い） */

/** 仮の本番の住所。独自ドメインにしたら、ここを変える */
export const FALLBACK_SITE = "https://ashiba-kyouiku-nkdr.vercel.app";

const trim = (s: string) => s.replace(/\/+$/, "");

/** 決め直しのメールの戻り先に使う、この仕組みの住所。

    手元（localhost）で動かしているときだけは、そのまま手元へ戻す。
    本番の住所へ飛ばすと、手元で直しているものを確かめられない。 */
export function siteUrl(origin?: string | null): string {
  const o = (origin ?? "").trim();
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o)) return trim(o);
  const set = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  return trim(set || FALLBACK_SITE);
}
