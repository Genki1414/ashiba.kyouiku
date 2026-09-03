import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";

/* 受講リクエストを「対応した」にする（教育担当者）。

   受講者が「この講座を受けたい」と送ってきたものを、
   担当者が確かめて閉じる。席を用意したことを確認する画面ではなく、
   ここでは印を立てるだけ。実際の受講コードはいつもどおり別に作る。

   動かせるのは自社宛のリクエストだけ。会社は画面から受け取らない
   （ログインしている担当者の会社を使う）。 */

type Body = { id?: string; on?: boolean };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const id = typeof b.id === "string" ? b.id.trim() : "";
  if (!id) {
    return NextResponse.json({ ok: false, reason: "どのリクエストか分かりません。" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("handle_course_request", {
    p_id: id,
    p_company: admin.companyId,
    p_admin: admin.userId,
    p_on: b.on !== false,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 403 });
  if (data === false) {
    return NextResponse.json({ ok: false, reason: "そのリクエストがありません。" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
