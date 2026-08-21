"use client";

import { useEffect } from "react";

/* 圏外でも開けるようにする仕込み。
   本番でだけ入れる（開発中に古い写しを掴むと、直したものが出なくなるため）。 */
export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 入れられない端末でも、ふつうに使える */
      });
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
