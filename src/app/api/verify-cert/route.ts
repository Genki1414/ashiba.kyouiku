import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { isCertNo } from "@/lib/cert";

/* 修了証の照会。
   証明番号を受け取り、「その番号の修了証があるか」だけを返す。

   氏名は伏せ字にする。番号を総当たりされても、
   人の名前が漏れないようにするため。
   本当に本人か確かめたいときは、手元の紙と見比べてもらう。 */

const mask = (name: string) => {
  const s = name.replace(/\s+/g, "");
  if (!s) return "";
  if (s.length <= 1) return s;
  return s[0] + "○".repeat(Math.min(s.length - 1, 4));
};

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("no") ?? "";
  const no = raw.trim().toUpperCase();
  if (!isCertNo(no)) {
    return NextResponse.json({ found: false, reason: "証明番号の形が違います。" }, { status: 400 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { found: false, reason: "照会の仕組みがまだ用意されていません。" },
      { status: 503 },
    );
  }

  const { data } = await supabase
    .from("certificates")
    .select("cert_no, issued_at, revoked_at, enrollment_id")
    .eq("cert_no", no)
    .maybeSingle();

  if (!data) return NextResponse.json({ found: false });
  if (data.revoked_at) {
    return NextResponse.json({ found: true, valid: false, reason: "取り消されています。" });
  }

  const { data: enr } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("id", data.enrollment_id as string)
    .maybeSingle();
  let name = "";
  if (enr?.user_id) {
    const { data: u } = await supabase
      .from("users")
      .select("name")
      .eq("id", enr.user_id as string)
      .maybeSingle();
    name = mask((u?.name as string) ?? "");
  }

  return NextResponse.json({
    found: true,
    valid: true,
    certNo: data.cert_no,
    issuedAt: data.issued_at,
    name,
    course: "足場の組立て等の業務に係る特別教育（学科）",
  });
}
