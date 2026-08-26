import { InvoiceClient } from "./InvoiceClient";

/* 請求書。本部が印刷して送る */
export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <InvoiceClient orderId={orderId} />;
}
