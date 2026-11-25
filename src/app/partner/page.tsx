import { notFound } from "next/navigation";
import { PartnerClient } from "./PartnerClient";
import { membershipEnabled } from "@/lib/membership.server";

/* 営業パートナー（0040）。本人の画面。制度を開けていない店では 404 */
export const dynamic = "force-dynamic";

export default function PartnerPage() {
  if (!membershipEnabled()) notFound();
  return <PartnerClient />;
}
