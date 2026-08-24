import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { myCompany, needsJoin } from "@/lib/tenant";
import { currentOwner } from "@/lib/owner";

/* いまの自分の立場。ホームの出し分けに使う。

   ホームを静的なまま置いておきたいので、サーバ側で読まずにここから聞く
   （AccountBar と同じやり方）。 */

export async function GET() {
  const owner = await currentOwner();
  const admin = await currentAdmin();
  if (admin) {
    return NextResponse.json({
      ok: true,
      admin: true,
      owner: !!owner,
      needsJoin: false,
      company: admin.companyName,
    });
  }
  const [join, co] = await Promise.all([needsJoin(), myCompany()]);
  return NextResponse.json({
    ok: true,
    admin: false,
    owner: !!owner,
    needsJoin: join,
    company: co?.name ?? "",
  });
}
