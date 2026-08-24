import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { isJoinCode, normalizeJoinCode } from "@/training/joinCode";

/* 参加コードで、自分の事業者に入る。

   合言葉を1つ持っているだけの人が総当たりで他社に入れないよう、
   形が合っていないものは数える前に断る。 */

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "ログインしてください。" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = normalizeJoinCode(body.code ?? "");
  if (!isJoinCode(code)) {
    return NextResponse.json({ ok: false, reason: "参加コードの形が違います。" }, { status: 400 });
  }

  const { data: co } = await supabase
    .from("companies")
    .select("id, name")
    .eq("join_code", code)
    .maybeSingle();
  if (!co) {
    return NextResponse.json({ ok: false, reason: "そのコードの事業者がありません。" }, { status: 404 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.company_id && me.company_id !== co.id) {
    return NextResponse.json(
      { ok: false, reason: "すでに別の事業者に属しています。担当者に頼んでください。" },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("users")
    .update({ company_id: co.id as string })
    .eq("id", user.id);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, company: co.name as string });
}
