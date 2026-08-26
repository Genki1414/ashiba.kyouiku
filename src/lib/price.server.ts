import "server-only";
import { parseUnitPrice } from "./pricing";

/* 単価。サーバだけが読む。

   SEAT_UNIT_PRICE には NEXT_PUBLIC_ を付けていないので、ブラウザには届かない。
   画面で読むと既定値（仮の値）になり、
   「見せている金額」と「実際に請求する金額」が食い違う。
   だからここを server-only にして、画面から読めないようにしてある。

   画面に金額を出すときは、サーバから単価を渡すこと（/api/order の GET）。 */

export const unitPrice = (): number => parseUnitPrice(process.env.SEAT_UNIT_PRICE);

/* 実務トレーニング（第2章から先）の値段。1人ぶん。
   特別教育の席とは別の売り物なので、単価も分ける。
   決めていなければ、席と同じ値段にしておく（0円で配らないため）。 */
export const trainPrice = (): number =>
  parseUnitPrice(process.env.TRAIN_UNIT_PRICE) || unitPrice();
