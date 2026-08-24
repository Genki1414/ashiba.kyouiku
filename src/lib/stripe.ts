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

/** 支払い後の戻り先。Vercel の URL を使う */
export function siteUrl(): string {
  const v = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (!v) return "http://localhost:3000";
  return v.startsWith("http") ? v : `https://${v}`;
}
