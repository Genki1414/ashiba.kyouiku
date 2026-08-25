import { canLearn } from "@/lib/entitle";
import { NeedSeat } from "@/components/NeedSeat";
import { TrialNote } from "@/components/TrialNote";

/* 毎回サーバで見張る。作り置き（静的生成）にすると、
   出来上がった教材の頁が、誰にでもそのまま返ってしまう */
export const dynamic = "force-dynamic";

/* 実務トレーニングの入口の見張り。学科（/edu）と同じ決まり。
   資材カタログと通し見学もこの下にあるので、まとめて止まる。 */

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const may = await canLearn();
  if (!may.ok) return <NeedSeat why={may.why} company={may.company} />;
  return (
    <>
      {may.by === "trial" && <TrialNote />}
      {children}
    </>
  );
}
