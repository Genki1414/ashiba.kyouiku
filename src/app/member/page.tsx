import { notFound } from "next/navigation";
import { MemberClient } from "./MemberClient";
import { membershipEnabled } from "@/lib/membership.server";

/* 法人会員（0040）。事業者の担当者の画面。
   制度を開けていない店では無いのと同じ（404）。指示書 §17 */
export const dynamic = "force-dynamic";

export default function MemberPage() {
  if (!membershipEnabled()) notFound();
  return <MemberClient />;
}
