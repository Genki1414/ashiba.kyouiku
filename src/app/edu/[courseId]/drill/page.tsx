import { notFound } from "next/navigation";
import Link from "next/link";
import { drillMinOf, findCourse } from "@/content/courses";
import { drillGuideOf } from "@/content/drill";
import { DrillGuideView } from "./DrillGuideView";

/* 実技の手引き。実技のある講座（gate: "drill"）にしか置かない。

   学科はこの画面で見られるが、実技は事業者が自社で行う。
   「実技をやってください」だけでは、何を何分やればいいか分からない。
   ここで、3時間の割り振りの案・誰がやるか・何を用意するか・
   実施記録の様式（印刷できる）を出す。

   ログインは要らない。受講者本人だけでなく、実技を行う会社の人が
   見る画面なので、誰でも開けるようにしてある（中身は公開情報）。 */
export default async function DrillPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = findCourse(courseId);
  const guide = course ? drillGuideOf(course.id) : null;
  if (!course || !guide || drillMinOf(course) <= 0) notFound();
  return (
    <main className="mx-auto max-w-[720px] pb-10">
      <div className="px-5 pt-5 print:hidden">
        <Link href={`/edu/${course.id}`} className="backlink text-[13px] text-dim no-underline">
          ← {course.short}の一覧
        </Link>
      </div>
      <DrillGuideView course={{ id: course.id, name: course.name, basis: course.basis }} guide={guide} />
    </main>
  );
}
