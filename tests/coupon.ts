/* クーポンの計算を確かめる。実行: npx tsx tests/coupon.ts

   ここで見るのは、SQL に頼らずに確かめられること。
   **値引きの式は SQL（0032 の coupon_discount）にも同じものがある。**
   食い違うと、見せた金額と請求する金額が違ってしまうので、
   同じ数を両方に入れて、同じ答えになることを見る
   （SQL 側は supabase/tests/coupon.sql）。 */

import { discountOf, lineAmount, normalizeCouponCode, rewardOf, spreadDiscount } from "../src/lib/coupon";
import { TAX_RATE } from "../src/lib/pricing";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };
const eq = (a: unknown, b: unknown, m: string) =>
  check(a === b, `${m}（${JSON.stringify(a)} ≠ ${JSON.stringify(b)}）`);

console.log("── 打ち方の揺れ ──");
{
  eq(normalizeCouponCode(" plant10 "), "PLANT10", "小文字と空白をそろえる");
  eq(normalizeCouponCode("ＰＬＡＮＴ１０"), "PLANT10", "全角も半角にそろえる");
  eq(normalizeCouponCode("PL ANT 10"), "PLANT10", "途中の空白も落とす");
}

console.log("── 値引き ──");
{
  eq(discountOf({ percentOff: 10 }, 22500), 2250, "率で引く");
  /* 端数は切り捨て。1円でも多く引くと、こちらの取り分が減る */
  eq(discountOf({ percentOff: 10 }, 4505), 450, "端数は切り捨て");
  eq(discountOf({ amountOff: 3000 }, 22500), 3000, "定額で引く");
  /* **割引前を超えない。**超えると総額がマイナスになる */
  eq(discountOf({ amountOff: 3000 }, 2000), 2000, "値引きは割引前を超えない");
  eq(discountOf({ percentOff: 100 }, 10000), 10000, "100%引きでちょうど0円");
  eq(discountOf({ percentOff: 10 }, 0), 0, "金額が0なら値引きも0");
  eq(discountOf({}, 10000), 0, "率も定額も無ければ引かない");
}

console.log("── 広告費 ──");
{
  /* 割引後の税抜 ×％（げんきさん 2026-09-09） */
  eq(rewardOf(20250, 20), 4050, "割引後の税抜に率を掛ける");
  eq(rewardOf(10000, 0), 0, "率が0なら広告費も0");
  eq(rewardOf(0, 20), 0, "売上が0なら広告費も0");
  eq(rewardOf(3333, 15), 499, "端数は切り捨て");
}

console.log("── 値引きを講座ごとの行に配る ──");
{
  const spread = spreadDiscount([22500, 21000, 10000], 5350);
  eq(spread.reduce((n, x) => n + x, 0), 5350, "配ったものを足すと、元の値引きになる");
  check(spread.every((x) => x >= 0), "どの行も0円以上");
  /* 高い行のほうが、多く引かれる */
  check(spread[0] >= spread[2], "高い行のほうが多く引かれる");

  eq(spreadDiscount([10000], 3000)[0], 3000, "1行なら、そのまま全部");
  eq(spreadDiscount([10000, 10000], 3000).join("/"), "1500/1500", "同じ額なら半々");
  /* **端数が出ても、配り切る。**残すと合計が合わない */
  eq(spreadDiscount([100, 100, 100], 100).reduce((n, x) => n + x, 0), 100, "端数も配り切る");
  eq(spreadDiscount([9000, 1000], 10000).join("/"), "9000/1000", "全額引きでも、行を超えない");
  eq(spreadDiscount([5000, 5000], 0).join("/"), "0/0", "値引きが0なら、どの行も0");

  /* いろいろな組み合わせで、合計が合い、行の額を超えない */
  let bad = 0;
  for (let t = 0; t < 400; t++) {
    const n = 1 + (t % 5);
    const subs = Array.from({ length: n }, (_, i) => 1000 + ((t * 977 + i * 613) % 90000));
    const gross = subs.reduce((a, b) => a + b, 0);
    const d = (t * 37) % (gross + 1);
    const got = spreadDiscount(subs, d);
    if (got.reduce((a, b) => a + b, 0) !== d) bad++;
    if (got.some((x, i) => x > subs[i] || x < 0)) bad++;
  }
  eq(bad, 0, "どの組み合わせでも、合計が合って、行の額を超えない");
}

console.log("── 値引きしたあとの、行の金額 ──");
{
  const a = lineAmount(22500, 2250);
  eq(a.net, 20250, "税抜は値引き後");
  eq(a.tax, Math.floor(20250 * TAX_RATE), "税は値引き後にかかる");
  eq(a.amount, 20250 + Math.floor(20250 * TAX_RATE), "税込は税抜＋税");
  /* 値引きが無いときは、今までと同じ額のまま（古い注文と食い違わせない） */
  const b = lineAmount(22500, 0);
  eq(b.amount, 22500 + Math.floor(22500 * TAX_RATE), "値引きが無ければ、今までと同じ");
  eq(lineAmount(1000, 5000).amount, 0, "行の額より大きい値引きでも、マイナスにしない");
}

console.log(`\n${ok} 件通過 / ${ng} 件失敗`);
process.exit(ng ? 1 : 0);
