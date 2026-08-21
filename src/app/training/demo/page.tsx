import { Suspense } from "react";
import { DemoClient } from "./DemoClient";

/* 組立の通し見学（15手）。第1章のチュートリアルに入る前に一度通す */
export default function DemoPage() {
  return (
    <Suspense>
      <DemoClient />
    </Suspense>
  );
}
