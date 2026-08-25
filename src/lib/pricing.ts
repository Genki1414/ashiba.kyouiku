/* 値段の計算。画面にもデータベースにも触らない、ただの計算。
   画面（クライアント）からも読む。

   単価そのものは、ここでは読まない。読むのは src/lib/price.server.ts。
   SEAT_UNIT_PRICE は NEXT_PUBLIC_ ではないので、ブラウザからは見えない。
   ここで読むと、画面に出す金額と実際に請求する金額が食い違う。 */

/** 1人ぶんの受講コードの値段（税抜・円）。仮置き */
export const DEFAULT_UNIT_PRICE = 3000;

/** 設定に書かれた単価を読む。おかしければ仮置きの値。
    環境変数そのものを読むのはサーバだけ（src/lib/price.server.ts） */
export function parseUnitPrice(raw: string | undefined): number {
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && `${raw}`.trim() !== "" ? Math.round(v) : DEFAULT_UNIT_PRICE;
}

/** 消費税 */
export const TAX_RATE = 0.1;

/** 一度に買える人数の上限。押し間違いで桁を増やさないため */
export const MAX_SEATS = 500;

export type Quote = {
  seats: number;
  /** 税抜の単価 */
  unitPrice: number;
  /** 税抜の小計 */
  subtotal: number;
  /** 消費税（円・切り捨て） */
  tax: number;
  /** 税込の合計。orders.amount に入る */
  total: number;
};

/** 人数から金額を出す。単価は必ず渡す（サーバが持っている値）。
    人数がおかしければ null */
export function quote(seats: number, price: number): Quote | null {
  if (!Number.isFinite(price) || price < 0) return null;
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) return null;
  const subtotal = price * seats;
  const tax = Math.floor(subtotal * TAX_RATE);
  return { seats, unitPrice: price, subtotal, tax, total: subtotal + tax };
}

/** 「1,234円」 */
export const yen = (n: number): string => `${n.toLocaleString("ja-JP")}円`;

/** 請求書払いの支払期限。月末締め翌月末払いに寄せて、30日後の月末 */
export function dueDate(from: Date): Date {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + 30);
  /* その月の末日 */
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
