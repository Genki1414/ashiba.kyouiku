import Stripe from "stripe";

/* Stripe。鍵が無ければ null を返し、カード払いは画面に出さない。
   請求書払いだけで売れるので、鍵が揃うまでは止めずに動かす。 */

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

/** カード払いを出してよいか */
export const hasStripe = (): boolean => !!process.env.STRIPE_SECRET_KEY;

/** 支払い後の戻り先。

    サーバでしか使わないので NEXT_PUBLIC_ は要らない（SITE_URL）。
    以前 NEXT_PUBLIC_SITE_URL と案内したので、そちらも読む。
    どちらも無ければ Vercel が入れる VERCEL_URL を使うが、
    これは配信ごとに変わる住所なので、本番は SITE_URL を決めておくこと。 */
export function siteUrl(): string {
  const v =
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (!v) return "http://localhost:3000";
  return v.startsWith("http") ? v : `https://${v}`;
}
