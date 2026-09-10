import { CertClient } from "./CertClient";
import { canLearn } from "@/lib/entitle";
import { NeedSeat } from "@/components/NeedSeat";

/* 修了証。学科の全単元と修了試験に合格した人だけが開ける */
export default async function CertPage({
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
  return <CertClient courseId={courseId} />;
}
