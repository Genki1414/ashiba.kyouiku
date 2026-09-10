import { Suspense } from "react";
import { canLearn } from "@/lib/entitle";
import { NeedSeat } from "@/components/NeedSeat";
import { PrepClient } from "./PrepClient";

/* 受講の準備（同意 → 本人確認）。中身はすべてクライアント側 */
export default async function PrepPage({
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
  return (
    <Suspense>
      <PrepClient courseId={courseId} />
    </Suspense>
  );
}
