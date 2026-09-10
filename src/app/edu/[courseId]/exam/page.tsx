import { notFound } from "next/navigation";
import { canLearn } from "@/lib/entitle";
import { NeedSeat } from "@/components/NeedSeat";
import { getCurriculum } from "@/lib/curriculum";
import { ExamClient } from "./ExamClient";

/* 修了試験。全単元の修了が受験の条件（判定はクライアント側の進捗読み込みで行い、
   採点と記録はサーバ側 /api/exam が行う） */
export default async function ExamPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  /* **その講座の受講コードを持っている人だけ。**
     画面を隠すのではなく、ここで止めて中身を作らない
     （作ってしまうと、売り物がそのまま返る） */
  const may = await canLearn(courseId);
  if (!may.ok) return <NeedSeat why={may.why} company={may.company} />;
  const cur = await getCurriculum(courseId);
  if (!cur) notFound();
  const lessonIds = cur.subjects.flatMap((s) => s.lessons.map((l) => l.id));
  return <ExamClient courseId={courseId} lessonIds={lessonIds} />;
}
