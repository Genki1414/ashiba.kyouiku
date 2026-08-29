import "server-only";
import { pickUnitPrice, priceEnvName, parseUnitPrice } from "./pricing";
import { COURSES, readyCourses } from "@/content/courses";

/* 単価。サーバだけが読む。

   SEAT_UNIT_PRICE には NEXT_PUBLIC_ を付けていないので、ブラウザには届かない。
   画面で読むと既定値（仮の値）になり、
   「見せている金額」と「実際に請求する金額」が食い違う。
   だからここを server-only にして、画面から読めないようにしてある。

   画面に金額を出すときは、サーバから単価を渡すこと（/api/order の GET）。

   ── 決め方そのものは pricing.ts ──
   ここは process.env を読むだけ。決め方（順番と既定の値）は
   pricing.ts の pickUnitPrice にある。分けてあるので試験できる。 */

/** その講座の単価（税抜・円）。

    値上げ・値下げは Vercel の環境変数で。どれも税抜で入れる（税は quote() が足す）。

      SEAT_UNIT_PRICE_ASHIBA    … 足場だけ
      SEAT_UNIT_PRICE_SHOKUCHO  … 職長だけ
      SEAT_UNIT_PRICE           … 上が無い講座ぜんぶ */
export const unitPrice = (courseId?: string): number =>
  pickUnitPrice({
    courseId,
    own: courseId ? process.env[priceEnvName(courseId)] : undefined,
    all: process.env.SEAT_UNIT_PRICE,
  });

/** 受けられる講座ぜんぶの単価。特定商取引法の表記に載せる。

    1つしか載せないと、載っていない講座の値段が書いていないことになる。 */
export const allPrices = (): { id: string; name: string; price: number }[] =>
  readyCourses().map((c) => ({ id: c.id, name: c.name, price: unitPrice(c.id) }));

/** 値段が0円のまま公開している講座。/setup で出す */
export const missingPrice = (): string[] =>
  COURSES.filter((c) => c.ready && unitPrice(c.id) <= 0).map((c) => c.id);

/* 実務トレーニング（第2章から先）の値段。1人ぶん。
   特別教育の席とは別の売り物なので、単価も分ける。
   決めていなければ、足場の席と同じ値段にしておく（0円で配らないため）。 */
export const trainPrice = (): number =>
  parseUnitPrice(process.env.TRAIN_UNIT_PRICE) || unitPrice("ashiba");
