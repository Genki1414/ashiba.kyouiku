import { NextRequest, NextResponse } from "next/server";
import { drillMinOf, findCourse } from "@/content/courses";
import { drillGuideOf } from "@/content/drill";
import { recordDocHtml, recordFileName } from "@/lib/drillRecord";

/* 実技の実施記録の様式を、ファイルで渡す。

   手引きの画面からも印刷できるが、**実技をやるのは会社の人で、
   その人はうちの画面を開いたままにしておかない。**
   手元に落として、人数分を何度でも印刷できるようにする。

   ログインは要らない（手引きの画面と同じ。中身は公開情報）。
   出すのは1枚ものの HTML。開けばそのまま印刷でき、
   ブラウザの印刷から PDF にもできる。 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("courseId") ?? "").trim();
  const course = findCourse(id);
  const guide = course ? drillGuideOf(course.id) : null;
  /* 学科だけの講座に様式は無い。空の紙を出すと、
     「実技をやらなくてよい講座」に実技の記録が残る */
  if (!course || !guide || drillMinOf(course) <= 0) {
    return NextResponse.json({ ok: false, reason: "その講座に実技はありません。" }, { status: 404 });
  }
  const html = recordDocHtml(
    { id: course.id, name: course.name, basis: course.basis },
    guide,
  );
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${recordFileName(course.id)}"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
