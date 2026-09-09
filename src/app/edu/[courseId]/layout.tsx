import { canLearn } from "@/lib/entitle";
import { NeedSeat } from "@/components/NeedSeat";
import { findCourse } from "@/content/courses";
import { notFound } from "next/navigation";

/* 講座ごとの見張り。**ここが本番。**

   げんきさん（2026-09-09）
     「有償利用に切り替えてもどんな講座でも受けれてしまう」

   受講コードは講座ごとに売っている。なのに前は「1枚でも持っていれば通す」
   だったので、足場のコードを1枚持っているだけで73講座すべてが開いた。
   1講座ぶんの代金で全部見られる、ということ。

   ここで止めれば、単元も修了試験も討議も、この講座の下は全部止まる。
   断る画面には「この講座を受けたい」を送る所が付いている（NeedSeat）ので、
   行き止まりにはならない。 */

export const dynamic = "force-dynamic";

export default async function CourseGate({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  if (!findCourse(courseId)) notFound();

  const may = await canLearn(courseId);
  if (!may.ok) return <NeedSeat why={may.why} company={may.company} />;
  return <>{children}</>;
}
