import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { myCompany, needsJoin } from "@/lib/tenant";

/* いまの自分の立場。ホームの出し分けに使う。

   ホームを静的なまま置いておきたいので、サーバ側で読まずにここから聞く
   （AccountBar と同じやり方）。 */

export async function GET() {
  const admin = await currentAdmin();
  if (admin) {
    return NextResponse.json({
      ok: true,
      admin: true,
      needsJoin: false,
      company: admin.companyName,
    });
  }
  const [join, co] = await Promise.all([needsJoin(), myCompany()]);
  return NextResponse.json({
    ok: true,
    admin: false,
    needsJoin: join,
    company: co?.name ?? "",
  });
}
