import { InvoicesClient } from "./InvoicesClient";

/* 買った側の、請求書の一覧。発行された請求書は、払ったあともここに残る。 */
export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  return <InvoicesClient />;
}
