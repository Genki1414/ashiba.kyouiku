import { canLearn } from "@/lib/entitle";
import { NeedSeat } from "@/components/NeedSeat";
import { TrialNote } from "@/components/TrialNote";

/* 毎回サーバで見張る。作り置き（静的生成）にすると、
   出来上がった教材の頁が、誰にでもそのまま返ってしまう */
export const dynamic = "force-dynamic";

/* 学科の入口の見張り。

   受講コード（席）を引き換えた人だけを通す。
   画面を隠すのではなく、ここで止めて中身を作らない。
   作ってしまうと、教材の文章がそのまま返ってしまう。 */

export default async function EduLayout({ children }: { children: React.ReactNode }) {
  const may = await canLearn();
  if (!may.ok) return <NeedSeat why={may.why} company={may.company} />;
  return (
    <>
      {may.by === "trial" && <TrialNote />}
      {children}
    </>
  );
}
