import { Suspense } from "react";
import { PrepClient } from "./PrepClient";

/* 受講の準備（同意 → 本人確認）。中身はすべてクライアント側 */
export default function PrepPage() {
  return (
    <Suspense>
      <PrepClient />
    </Suspense>
  );
}
