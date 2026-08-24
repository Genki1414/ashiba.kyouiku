import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";

/* 教育担当者を増やす／戻す。自社の人だけ。
   最後の1人を降ろすと誰も画面を開けなくなるので、それは断る。 */

type Body = { userId?: string; admin?: boolean };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const me = await currentAdmin();
  if (!me) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const id = (body.userId ?? "").trim();
  const want = body.admin === true;
  if (!id) {
    return NextResponse.json({ ok: false, reason: "誰のことか分かりません。" }, { status: 400 });
  }

  const { data: target } = await supabase
    .from("users")
    .select("id, role, company_id")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.company_id !== me.companyId) {
    return NextResponse.json({ ok: false, reason: "自社の人ではありません。" }, { status: 403 });
  }

  if (!want) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", me.companyId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { ok: false, reason: "担当者が居なくなります。先にもう1人決めてください。" },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase
    .from("users")
    .update({ role: want ? "admin" : "learner" })
    .eq("id", id);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
