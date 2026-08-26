import { canTrain } from "@/lib/training";
import { NeedTrain } from "@/components/NeedTrain";
import { TrialNote } from "@/components/TrialNote";

/* 毎回サーバで見張る。作り置き（静的生成）にすると、
   出来上がった中身が、誰にでもそのまま返ってしまう */
export const dynamic = "force-dynamic";

/* 実務トレーニングの入口。

   第1章と、資材カタログ・通し見学は、ログインすれば誰でも（試し）。
   第2章から先は、利用権を持っている人だけ。
   止めるのはそれぞれの章の側（src/app/training/ch2 など）で、
   ここではログインだけを見る。

   学科（/edu）とは別の決まりにしてある。
   実務トレーニングは修了証の要件ではないので、席とは分ける。 */

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const may = await canTrain();
  /* ログインしていない人だけ、ここで止める */
  if (!may.ok && may.why === "signin") return <NeedTrain why="signin" />;
  return (
    <>
      {may.ok && may.by === "trial" && <TrialNote />}
      {children}
    </>
  );
}
