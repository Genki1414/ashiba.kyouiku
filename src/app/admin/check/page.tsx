import { Suspense } from "react";
import { CheckClient } from "./CheckClient";

export const dynamic = "force-dynamic";

export default function CheckPage() {
  return (
    <Suspense fallback={null}>
      <CheckClient />
    </Suspense>
  );
}
