/* クーポンの計算。画面にもデータベースにも触らない、ただの計算。
   画面（クライアント）からも読む。

   ── ここと SQL で、同じ式を使うこと ──
   値引きの式は supabase/migrations/0032_coupon.sql の coupon_discount にもある。
   **片方だけ直すと、見せた金額と請求する金額が食い違う。**
   食い違いは tests/coupon.ts と supabase/tests/coupon.sql が見ている。

   実際にいくら引くかを決めるのは SQL（use_coupon）。ここは
   「いくら引けるか」を先に見せるためと、値引きを講座ごとの行に配るため。 */

import { TAX_RATE } from "./pricing";

/** クーポンの中身。率か定額の、どちらか一方だけを持つ */
export type CouponRule = {
  /** 率（％）。10 なら 10%引き */
  percentOff?: number | null;
  /** 定額（税抜・円） */
  amountOff?: number | null;
};

/* 打ち方の揺れをそろえる。紙に書いたものを見て打つので、
   小文字・前後の空白・全角が混ざる。
   **受講コードと同じ考え方**（src/training/joinCode.ts） */
export function normalizeCouponCode(raw: string): string {
  return raw
    /* 全角の英数を半角に */
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

/** 値引き（税抜・円）。**割引前を超えない**（総額がマイナスにならない） */
export function discountOf(rule: CouponRule, gross: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  const g = Math.floor(gross);
  const pct = rule.percentOff ?? null;
  const amt = rule.amountOff ?? null;
  /* 端数は切り捨て。1円でも多く引くと、こちらの取り分が減る */
  const d = pct != null ? Math.floor((g * pct) / 100) : amt != null ? Math.floor(amt) : 0;
  return Math.max(0, Math.min(d, g));
}

/** 広告費（円）。**割引後の税抜売上 ×％**（げんきさん 2026-09-09） */
export function rewardOf(net: number, rate: number): number {
  if (!Number.isFinite(net) || net <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.floor((Math.floor(net) * Math.floor(rate)) / 100);
}

/* ── 値引きを、講座ごとの行に配る ──

   注文の行は講座ごと（受講コードは講座ごとに出るため）。
   請求書は行を足して出すので、**値引きも行に配っておかないと
   「合計だけ安いのに、明細を足すと合わない」請求書**になる。

   高い行から順に、1円の端数を足していく。
   全部の行の値引きを足すと、ちょうど元の値引きになる。 */
export function spreadDiscount(subtotals: number[], discount: number): number[] {
  const gross = subtotals.reduce((n, s) => n + s, 0);
  const out = subtotals.map(() => 0);
  if (discount <= 0 || gross <= 0) return out;
  const d = Math.min(Math.floor(discount), gross);

  for (let i = 0; i < subtotals.length; i++) {
    out[i] = Math.floor((d * subtotals[i]) / gross);
  }
  /* 落とした端数を、高い行から1円ずつ。
     **配り切るまで回す。**行の値引きが、その行の額を超えないように見る */
  let rest = d - out.reduce((n, x) => n + x, 0);
  const order = subtotals
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.i);
  let guard = 0;
  while (rest > 0 && guard < subtotals.length * 2 + 4) {
    for (const i of order) {
      if (rest <= 0) break;
      if (out[i] < subtotals[i]) {
        out[i] += 1;
        rest -= 1;
      }
    }
    guard += 1;
  }
  return out;
}

/** 値引きを引いたあとの、その行の金額（税込） */
export function lineAmount(subtotal: number, discount: number): { net: number; tax: number; amount: number } {
  const net = Math.max(0, Math.floor(subtotal) - Math.max(0, Math.floor(discount)));
  const tax = Math.floor(net * TAX_RATE);
  return { net, tax, amount: net + tax };
}
