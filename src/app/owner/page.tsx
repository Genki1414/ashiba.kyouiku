import { OwnerClient } from "./OwnerClient";
import { membershipEnabled } from "@/lib/membership.server";

/* 運営（売っている側）の画面。全事業者の注文と入金。
   「会員と報酬」の札は、会員制度（0040）を開けている店だけ（MEMBERSHIP_ENABLED） */
export const dynamic = "force-dynamic";

export default function OwnerPage() {
  return <OwnerClient membership={membershipEnabled()} />;
}
