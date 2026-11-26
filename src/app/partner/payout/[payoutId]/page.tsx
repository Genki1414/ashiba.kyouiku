import { notFound } from "next/navigation";
import { PayoutClient } from "@/components/PayoutClient";
import { membershipEnabled } from "@/lib/membership.server";

/* 報酬の支払明細（docs/122）。本人の向き */
export const dynamic = "force-dynamic";

export default async function PartnerPayoutPage({ params }: { params: Promise<{ payoutId: string }> }) {
  if (!membershipEnabled()) notFound();
  const { payoutId } = await params;
  return <PayoutClient payoutId={payoutId} mine />;
}
