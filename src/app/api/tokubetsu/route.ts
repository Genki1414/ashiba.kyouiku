import { NextRequest, NextResponse } from "next/server";
import { LISTED_ON, toCsv, toRows } from "@/content/tokubetsu";

/* 特別教育の目録を、そのまま持ち出せるようにする。

   ── なぜ誰でも読めるようにするか ──
   中身は**法令で決まっていて、誰でも読める**もの
   （厚生労働省の規程と、労働局の一覧）。隠す理由が無い。
   個人の情報も、値段も、社内の事情も入っていない。

   ── なぜ要るか ──
   この目録は、いずれ単体で事業にする。
   そのとき**別の仕組みへ丸ごと移せること**が要る。
   画面から手で写すのでは、写し間違いが入る。

     /api/tokubetsu           … JSON（機械で読む）
     /api/tokubetsu?format=csv … CSV（表計算に貼る）

   確かめたかどうか（hours_verified）も一緒に出す。
   **出した先で「全部裏を取ってある」と誤解されると、
   足りない時間の修了証が出る。** */

export async function GET(req: NextRequest) {
  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();

  if (format === "csv") {
    /* Excel は BOM が無いと日本語を文字化けさせる。
       付けないと、開いた人が「壊れている」と思って捨てる */
    return new NextResponse(`﻿${toCsv()}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="tokubetsu-${LISTED_ON}.csv"`,
        /* 法令が変わるまで動かない。1時間は持たせる */
        "cache-control": "public, max-age=3600",
      },
    });
  }

  const rows = toRows();
  return NextResponse.json(
    {
      ok: true,
      listedOn: LISTED_ON,
      count: rows.length,
      /* 時間を確かめた件数。持ち出した先でも、ここを見れば
         どこまで信じてよいかが分かる */
      verified: rows.filter((r) => r.hours_verified).length,
      note: "hours_verified が false の行の時間は、一覧を写しただけです。講座にする前に規程の条文から取り直してください。",
      rows,
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
