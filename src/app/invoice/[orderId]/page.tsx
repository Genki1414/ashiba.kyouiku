import { InvoiceClient } from "@/app/owner/invoice/[orderId]/InvoiceClient";

/* 買った側が見る請求書。中身は本部が見るものと同じ。
   誰に見せてよいかは /api/owner/invoice が見ている（src/lib/invoiceAccess.ts）。 */
export const dynamic = "force-dynamic";

export default async function MyInvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <InvoiceClient orderId={orderId} mine />;
}
