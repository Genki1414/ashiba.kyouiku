import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";

/* 実技の実施記録を1件だけ開く（本部の画面から）。

   一覧には「何が付いているか」しか出していない。
   写真の中身をぜんぶ一覧に載せると、開くだけで何十MBにもなるため。
   ここは、押した1件だけを返す。

   ── 気をつけていること ──
   ・**本部だけ。**個人の名前と事業者の印が写っている紙
   ・**キャッシュしない。**共有の端末で、前の人の記録が残らないように
   ・data URL のまま返さず、中身に戻して返す。
     ブラウザがそのまま画像・PDFとして開ける */
export async function GET(req: NextRequest) {
  const email = await currentOwner();
  if (!email) {
    return NextResponse.json({ ok: false, reason: "本部だけの画面です。" }, { status: 403 });
  }
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, reason: "どの記録か分かりません。" }, { status: 400 });
  }

  const { data } = await supabase
    .from("cert_request_files")
    .select("mime, data, filename")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ ok: false, reason: "その記録はありません。" }, { status: 404 });
  }

  const raw = `${data.data ?? ""}`;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(raw);
  if (!m) {
    return NextResponse.json({ ok: false, reason: "記録を読めませんでした。" }, { status: 500 });
  }
  const bytes = Buffer.from(m[2], "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": m[1],
      "content-disposition": "inline",
      "cache-control": "no-store, private",
      /* 記録そのものは画像・PDF。中で何かを動かさせない */
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
