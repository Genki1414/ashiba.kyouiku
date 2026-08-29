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

/* ── 講座ごとの単価 ─────────────────────────

   前は全講座で1つの単価だった。それだと、14時間の職長教育が
   6時間の特別教育と同じ値段になる。講座ごとに持たせる。

   ここに置いてあるのは**決め方**と、既定の値。
   実際にいくらで売るかは、環境変数を読むサーバが決める
   （src/lib/price.server.ts）。この関数は process.env を読まない。
   読ませると、画面から呼んだときに本当の値段が出てしまい、
   「見せている金額」と「請求する金額」が食い違う元になる。 */

/** 既定の単価（税抜・円）。

    よそのオンライン講習の、いちばん安いところより下に置いてある。
    （2026年8月に調べた。比べるのは税込）

      足場の組立て等特別教育（学科6時間）
        よそ … 8,000円〜10,505円（税込）
        ここ … 5,000円（税抜）＝ 5,500円（税込）

      職長・安全衛生責任者教育（14時間・討議つき）
        よそ … 17,600円（税込）
        ここ … 9,800円（税抜）＝ 10,780円（税込）

    変えるときは環境変数で。ここを書き換えると上げ直すまで直らない。 */
export const DEFAULT_COURSE_PRICE: Record<string, number> = {
  ashiba: 5000,
  shokucho: 9800,
};

/** 講座の目印から環境変数の名前を作る。ashiba → SEAT_UNIT_PRICE_ASHIBA */
export const priceEnvName = (courseId: string): string =>
  `SEAT_UNIT_PRICE_${courseId.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;

/** その講座の単価を決める。環境変数の値は、読んだ側から渡す。

    ① その講座だけの設定（SEAT_UNIT_PRICE_◯◯）
    ② 上の表の既定値
    ③ 全講座ぶんの設定（SEAT_UNIT_PRICE）
    ④ 仮置きの値
    の順。 */
export function pickUnitPrice(a: {
  courseId?: string;
  /** SEAT_UNIT_PRICE_◯◯ の値 */
  own?: string;
  /** SEAT_UNIT_PRICE の値 */
  all?: string;
}): number {
  const id = (a.courseId ?? "").trim();
  if (id) {
    if (`${a.own ?? ""}`.trim() !== "") return parseUnitPrice(a.own);
    const set = DEFAULT_COURSE_PRICE[id];
    if (typeof set === "number") return set;
  }
  return `${a.all ?? ""}`.trim() !== "" ? parseUnitPrice(a.all) : DEFAULT_UNIT_PRICE;
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
