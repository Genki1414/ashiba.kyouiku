import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";

/* よそで取った資格を「現物を見て確かめた」にする（教育担当者）。

   自己申告のままでは、事業者が確かめたことにならない。
   特別教育は「受けさせたか」を事業者が示せないといけないので、
   紙を見た人が押す、という形にする。

   押せるのは、その人がいま自社に在籍しているときだけ。
   会社は画面から受け取らない。ログインしている担当者の会社を使う。 */

type Body = { heldId?: string; on?: boolean };

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
  const heldId = typeof b.heldId === "string" ? b.heldId.trim() : "";
  if (!heldId) {
    return NextResponse.json({ ok: false, reason: "どの資格の話か分かりません。" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("confirm_qual", {
    p_id: heldId,
    p_company: admin.companyId,
    p_admin: admin.userId,
    p_on: b.on !== false,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 403 });
  if (data === false) {
    return NextResponse.json({ ok: false, reason: "その資格がありません。" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
