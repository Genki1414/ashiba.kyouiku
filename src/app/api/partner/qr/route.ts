import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { siteUrl } from "@/lib/siteUrl";
import { refUrl } from "@/lib/membership";
import { membershipEnabled } from "@/lib/membership.server";

/* 営業パートナーの紹介 URL の QR（docs/122）。本人だけ。
   資材屋・元請の担当者に紙で渡すためのもの。SVG で返す（印刷でぼやけない）。
   中身は紹介 URL だけ（氏名も会社名も入らない） */
export async function GET() {
  if (!membershipEnabled()) return NextResponse.json({ ok: false, reason: "準備中です。" }, { status: 404 });
  const supabase = getServiceClient();
  const me = supabase ? await currentUser() : null;
  if (!supabase || !me) return NextResponse.json({ ok: false, reason: "ログインしてください。" }, { status: 401 });
  const { data: sp, error } = await supabase.from("sales_partners").select("code").eq("user_id", me.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  if (!sp) return NextResponse.json({ ok: false, reason: "まだ登録がありません。" }, { status: 404 });
  const svg = await QRCode.toString(refUrl(siteUrl(), sp.code as string), {
    type: "svg",
    margin: 1,
    width: 512,
    errorCorrectionLevel: "M",
    color: { dark: "#0B1F3A", light: "#FFFFFF" },
  });
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="ref-${sp.code}.svg"`,
    },
  });
}
