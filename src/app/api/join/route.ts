import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { codeKind, normalizeJoinCode } from "@/training/joinCode";

/* コードを入れて、自分の事業者に入る。

   ・受講コード（12文字）… 1人1枚の席。入れると会社に入り、席が割り当たる
   ・参加コード（8文字）　… 名簿に入るだけ。席は割り当たらない
                            （修了証は席が要る。無償利用の事業者は例外）

   受け取る側は1つの入り口にしてある。現場の人に2種類を説明したくないため。
   形が合っていないものは、数える前に断る（総当たり避け）。 */

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
  const kind = codeKind(code);
  if (!kind) {
    return NextResponse.json({ ok: false, reason: "コードの形が違います。" }, { status: 400 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  /* ── 受講コード（席）── */
  if (kind === "seat") {
    const { data: companyId, error } = await supabase.rpc("redeem_seat", {
      p_code: code,
      p_user: user.id,
    });
    if (error || typeof companyId !== "string") {
      return NextResponse.json(
        { ok: false, reason: error?.message ?? "その受講コードは使えません。" },
        { status: 409 },
      );
    }
    const { data: co } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    return NextResponse.json({ ok: true, kind: "seat", company: (co?.name as string) ?? "" });
  }

  /* ── 参加コード ── */
  const { data: co } = await supabase
    .from("companies")
    .select("id, name")
    .eq("join_code", code)
    .maybeSingle();
  if (!co) {
    return NextResponse.json({ ok: false, reason: "そのコードの事業者がありません。" }, { status: 404 });
  }
  /* よその会社に居た人でも、そのまま移れる（転職）。
     前の会社の在籍は閉じるが、そこで受けた記録は前の会社に残る
     （受講が「どの会社の席で受けたか」を持っているため） */
  const { error } = await supabase.rpc("join_company", {
    p_user: user.id,
    p_company: co.id as string,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  const moved = !!me?.company_id && me.company_id !== co.id;
  return NextResponse.json({ ok: true, kind: "join", company: co.name as string, moved });
}
