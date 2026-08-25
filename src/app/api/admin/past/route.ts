import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { companyRecords } from "@/lib/records";

/* その事業者の受講記録ぜんぶ（辞めた人もふくむ）。

   毎日の名簿からは、抜けた人を外した。
   ただ、特別教育の記録は3年保存する決まりで、
   労働基準監督署などから「誰にいつ受けさせたか」を問われるのは
   **教育を受けさせた事業者**の側になる。
   出せるのが本部だけだと、そのたびに本部へ聞くことになる。
   だから、その会社の担当者も自分の事業者ぶんは出せるようにする。

   出せるのは自分の事業者ぶんだけ。
   companyId は受け取らない。受け取ると、番号を書き換えて
   よその事業者の記録を引ける道ができる。
   ここでは必ず currentAdmin() が返した事業者を使う。 */

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, reason: "教育担当者だけが見られる記録です。" },
      { status: 403 },
    );
  }

  const { people, totals } = await companyRecords(supabase, admin.companyId);
  return NextResponse.json({ ok: true, company: admin.companyName, people, totals });
}
