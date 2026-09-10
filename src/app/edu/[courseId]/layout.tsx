import { findCourse } from "@/content/courses";
import { notFound } from "next/navigation";

/* 講座の下の共通。

   ── 見張りをここに置かない理由（2026-09-10）──
   げんきさん「実技の手引きが出る講座と出ずに受講ページへ遷移する講座とがある」。

   ここで canLearn を見ていたので、**実技の手引き（/edu/◯◯/drill）まで
   塞いでいた。**手引きは実技を行う会社の人が見るもので、受講コードを
   持っているのは受ける本人。持っていない人が開くのが当たり前の画面だった。

   見張りは、売り物を出す頁それぞれに置く（単元・修了試験・修了証・
   受講の準備・討議）。**忘れると穴になる**ので、
   tests/api-auth.mts が頁を数えて見張っている。

   ── 押すたびに組み立て直さない（2026-09-10）──
   ここで force-dynamic にすると、**見張りの要らない実技の手引きまで**
   毎回サーバで組み立て直すことになる。見張る頁は、クッキーを読む時点で
   自動的にそうなるので、ここで決め打ちにしなくてよい。 */

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  if (!findCourse(courseId)) notFound();
  return <>{children}</>;
}
