import { notFound } from "next/navigation";
import { PayoutClient } from "@/components/PayoutClient";
import { membershipEnabled } from "@/lib/membership.server";

/* 報酬の支払明細（docs/122）。本部の向き。誰に見せてよいかは /api/owner/payout が見る */
export const dynamic = "force-dynamic";

export default async function OwnerPayoutPage({ params }: { params: Promise<{ payoutId: string }> }) {
  if (!membershipEnabled()) notFound();
  const { payoutId } = await params;
  return <PayoutClient payoutId={payoutId} />;
}
