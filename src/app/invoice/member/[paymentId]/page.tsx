import { notFound } from "next/navigation";
import { InvoiceClient } from "@/app/owner/invoice/[orderId]/InvoiceClient";
import { membershipEnabled } from "@/lib/membership.server";

/* 法人会員の月額の請求書（0040）。中身は受講コードの請求書と同じ枠。
   誰に見せてよいかは /api/owner/invoice が見ている（本部と、その事業者の担当者）。
   本部が開くときは ?owner=1 で「相手に知らせる」が出る */
export const dynamic = "force-dynamic";

export default async function MemberInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ owner?: string }>;
}) {
  if (!membershipEnabled()) notFound();
  const { paymentId } = await params;
  const { owner } = await searchParams;
  return <InvoiceClient orderId="" paymentId={paymentId} mine={owner !== "1"} />;
}
