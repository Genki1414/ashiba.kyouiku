import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { releaseSeat } from "@/lib/seats";

/* 受講コードの引き換えを取り消す。教育担当者だけ。

   自社の席かどうか、修了証が出ていないかは releaseSeat が見る。
   画面の出し分けではなく、ここを通さないと戻らない。 */

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code : "";

  const r = await releaseSeat(supabase, code, admin.companyId);
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: 409 });
  return NextResponse.json({ ok: true, code: r.code });
}
