import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";

/* 事業者をさがす。受講者が自分の会社を見つけるため。

   返すのは名前だけ。参加コードも担当者の名前も返さない。
   全部を並べては出さない（2文字以上の当たりが要る）。
   会社の一覧そのものが、よそに漏れて意味のあるものではないが、
   検索の形にしておけば「片っ端から集める」ことはできない。 */

const MIN = 2;
const MAX = 20;

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < MIN) {
    return NextResponse.json({ ok: true, rows: [], hint: `${MIN}文字以上で探してください。` });
  }

  /* % と _ は「なんでも当たる」印なので、そのまま渡さない */
  const safe = q.replace(/[%_\\]/g, (m) => `\\${m}`);
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .ilike("name", `%${safe}%`)
    .order("name")
    .limit(MAX);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    rows: (data ?? []).map((c) => ({ id: c.id as string, name: c.name as string })),
    capped: (data ?? []).length >= MAX,
  });
}
