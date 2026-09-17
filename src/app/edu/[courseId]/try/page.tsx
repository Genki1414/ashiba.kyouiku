import { notFound } from "next/navigation";
import { getLesson, getLessonOrder } from "@/lib/curriculum";
import { findCourse, readyCourses } from "@/content/courses";
import { unitPrice } from "@/lib/price.server";
import { quote } from "@/lib/pricing";
import { TryClient } from "./TryClient";

/* 無料の1単元（0039）。**ログインなしで、第1単元を見るだけ。**

   げんきさん（2026-09-17）「1と3作って」（3＝第1単元をログインなしで見せる）

   ── なぜ開けてよいか ──
   払う前に中身を1単元も見られないと、4,950円を先に振り込む理由が無い。
   ここは売り物の一部だが、**第1単元だけ・記録なし・修了証の要件にならない**。
   見張り（tests/api-auth.mts の OPEN_PAGES）にも、そう書いてある。

   ── 何をしないか ──
   ・時間を数えない。合格を記録しない（/api/progress を呼ばない）
   ・顔の照合をしない（カメラを使わない）
   ・受講の準備（/prep）へ送らない
   本番の受講は、申し込んでから（/solo か、会社の受講コード）。

   値段はここで出す（作り置きにしない。環境変数で変えたら、その場で変わる） */
export const dynamic = "force-dynamic";

export default async function TryPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = findCourse(courseId);
  if (!course || !course.ready) notFound();

  const order = await getLessonOrder(courseId);
  const firstId = order[0];
  const found = firstId ? await getLesson(courseId, firstId) : null;
  if (!found) notFound();

  const q = quote(1, unitPrice(courseId));
  return (
    <TryClient
      course={{ id: course.id, name: course.name, short: course.short }}
      subject={found.subject}
      lesson={found.lesson}
      lessons={order.length}
      total={q?.total ?? 0}
      /* ほかの講座も試せる、と分かるように（店で並びが違うので数だけ） */
      others={readyCourses().length - 1}
    />
  );
}
