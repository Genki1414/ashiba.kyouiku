import { notFound } from "next/navigation";
import { getLesson, getLessonOrder } from "@/lib/curriculum";
import { LessonClient } from "./LessonClient";

/* 受講画面の入口（サーバ側）。教材の取得と前後の単元の解決 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const found = await getLesson(lessonId);
  if (!found) notFound();

  const order = await getLessonOrder();
  const i = order.indexOf(lessonId);
  return (
    <LessonClient
      subject={found.subject}
      lesson={found.lesson}
      prevId={i > 0 ? order[i - 1] : null}
      nextId={i < order.length - 1 ? order[i + 1] : null}
    />
  );
}

export async function generateStaticParams() {
  const order = await getLessonOrder();
  return order.map((lessonId) => ({ lessonId }));
}
