import { Suspense } from "react";
import { OrderClient } from "./OrderClient";

/* 申込み。教育担当者が人数ぶんの受講コードを買う。
   支払い後の戻り先で ?paid= を読むので、Suspense で包む（Next の決まり） */
export default function OrderPage() {
  return (
    <Suspense>
      <OrderClient />
    </Suspense>
  );
}
