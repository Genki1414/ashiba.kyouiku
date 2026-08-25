import { notFound } from "next/navigation";
import { getLesson, getLessonOrder } from "@/lib/curriculum";
import { LessonClient } from "./LessonClient";

/* 作り置き（静的生成）はしない。
   出来上がった単元の頁が置いてあると、受講コードの見張り（layout）を
   通さずに教材の文章が返ってしまう */
export const dynamic = "force-dynamic";

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
