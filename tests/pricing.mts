/* 値段の計算の試験。実行: npx tsx tests/pricing.ts */

import { DEFAULT_UNIT_PRICE, MAX_SEATS, TAX_RATE, dueDate, parseUnitPrice, quote, yen } from "@/lib/pricing";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 単価 ──");
/* 環境変数を読むのはサーバだけ（src/lib/price.server.ts）。
   ここでは、読んだ値の解釈だけを確かめる */
check(parseUnitPrice(undefined) === DEFAULT_UNIT_PRICE, `未設定なら仮の値（${DEFAULT_UNIT_PRICE}円）`);
check(parseUnitPrice("4500") === 4500, "設定してあればその値");
check(parseUnitPrice("へんな値") === DEFAULT_UNIT_PRICE, "数字でなければ仮の値に戻す");
check(parseUnitPrice("-100") === DEFAULT_UNIT_PRICE, "負の値は使わない");
check(parseUnitPrice("") === DEFAULT_UNIT_PRICE, "空も仮の値");
check(parseUnitPrice("  ") === DEFAULT_UNIT_PRICE, "空白だけも仮の値");
check(parseUnitPrice("3000.6") === 3001, "小数は丸める");
check(parseUnitPrice("0") === 0, "0円も設定できる（無料で配るとき）");

console.log("── 金額 ──");
{
  const q = quote(10, 3000)!;
  check(q.subtotal === 30000, `10名の小計（${q.subtotal}）`);
  check(q.tax === 3000, `消費税${TAX_RATE * 100}%（${q.tax}）`);
  check(q.total === 33000, `税込（${q.total}）`);
  check(q.unitPrice === 3000 && q.seats === 10, "内訳が入る");
}
{
  /* 端数は切り捨て。1円多く請求しない */
  const q = quote(1, 3333)!;
  check(q.tax === 333, `端数は切り捨て（${q.tax}）`);
  check(q.total === 3666, `税込（${q.total}）`);
}
check(quote(1, 3000) !== null, "1名は通る");
check(quote(MAX_SEATS, 3000) !== null, `${MAX_SEATS}名は通る`);
check(quote(0, 3000) === null, "0名は通さない");
check(quote(10, Number.NaN) === null, "単価が数字でなければ出さない");
check(quote(10, -1) === null, "単価が負なら出さない");
check(quote(-3, 3000) === null, "負の人数は通さない");
check(quote(MAX_SEATS + 1, 3000) === null, "上限より多い人数は通さない（押し間違い避け）");
check(quote(1.5, 3000) === null, "半端な人数は通さない");
check(quote(Number.NaN, 3000) === null, "数字でないものは通さない");

console.log("── 見せ方 ──");
check(yen(33000) === "33,000円", `桁を区切る（${yen(33000)}）`);
check(yen(0) === "0円", "0円");

console.log("── 支払期限 ──");
{
  /* 30日後の、その月の末日 */
  const d = dueDate(new Date("2026-08-22T00:00:00+09:00"));
  check(d.getMonth() === 8, `9月になる（${d.getMonth() + 1}月）`);
  check(d.getDate() === 30, `末日（${d.getDate()}日）`);
  const feb = dueDate(new Date("2026-01-15T00:00:00+09:00"));
  check(feb.getDate() === 28, `2月は28日（${feb.getMonth() + 1}/${feb.getDate()}）`);
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
