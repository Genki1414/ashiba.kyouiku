import { Suspense } from "react";
import { CatalogClient } from "./CatalogClient";

/* 資材カタログ。第1章に入る前と、章の中の「資材」からいつでも開ける */
export default function CatalogPage() {
  return (
    <Suspense>
      <CatalogClient />
    </Suspense>
  );
}
