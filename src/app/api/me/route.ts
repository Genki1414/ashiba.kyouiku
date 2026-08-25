import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin";
import { myCompany, needsJoin } from "@/lib/tenant";
import { currentOwner } from "@/lib/owner";
import { canLearn } from "@/lib/entitle";
import { readyCourses } from "@/content/courses";

/* いまの自分の立場。ホームの出し分けに使う。

   ホームを静的なまま置いておきたいので、サーバ側で読まずにここから聞く
   （AccountBar と同じやり方）。 */

export async function GET() {
  const owner = await currentOwner();
  const admin = await currentAdmin();
  /* 受講コードを持っているか。持っていない人に学科の札を押させると、
     開いた先で断られるだけなので、ホームで先に知らせる */
  const learn = await canLearn();
  if (admin) {
    return NextResponse.json({
      ok: true,
      admin: true,
      owner: !!owner,
      needsJoin: false,
      canLearn: learn.ok,
      courses: readyCourses().length,
      company: admin.companyName,
    });
  }
  const [join, co] = await Promise.all([needsJoin(), myCompany()]);
  return NextResponse.json({
    ok: true,
    admin: false,
    owner: !!owner,
    needsJoin: join,
    canLearn: learn.ok,
    courses: readyCourses().length,
    company: co?.name ?? "",
  });
}
