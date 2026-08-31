import { findCourse, totalNoteOf } from "@/content/courses";

/* 注文の品名。Stripe の明細と領収書に、この文字がそのまま残る。

   決め打ちにしていたので、職長教育を買った人の領収書にも
   「足場の特別教育（学科）受講コード」と出ていた。
   7,000円の職長を買って、違う品名の領収書が残ると経理で必ず引っかかる。
   実務トレーニングを買ったときも同じ字が出ていた。

   講座は増えるので、注文の行（kind と course_id）から作る。 */

/** 実務トレーニングの品名。第1章は無償なので、売るのは第2章から */
export const TRAIN_LABEL = "実務トレーニング（第2章以降）";

export function orderLabel(o: { kind?: string | null; courseId?: string | null }): string {
  if ((o.kind ?? "seat") === "training") return TRAIN_LABEL;
  const c = findCourse(o.courseId);
  /* 講座が引けないときは、嘘の講座名を出すより広い言い方にする。
     消えた講座の古い注文でも、間違った名前は残さない */
  if (!c) return "教育（学科）受講コード";
  return `${c.name}（${totalNoteOf(c)}）受講コード`;
}
