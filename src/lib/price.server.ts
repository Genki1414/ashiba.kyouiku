import "server-only";
import { parseUnitPrice } from "./pricing";

/* 単価。サーバだけが読む。

   SEAT_UNIT_PRICE には NEXT_PUBLIC_ を付けていないので、ブラウザには届かない。
   画面で読むと既定値（仮の値）になり、
   「見せている金額」と「実際に請求する金額」が食い違う。
   だからここを server-only にして、画面から読めないようにしてある。

   画面に金額を出すときは、サーバから単価を渡すこと（/api/order の GET）。 */

export const unitPrice = (): number => parseUnitPrice(process.env.SEAT_UNIT_PRICE);
