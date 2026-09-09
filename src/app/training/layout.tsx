import { notFound } from "next/navigation";
import { canTrain } from "@/lib/training";
import { BRAND } from "@/content/brand";
import { NeedTrain } from "@/components/NeedTrain";

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
  /* **売っていない店では、この道ごと無い。**
     特別教育ドットコムは実務トレーニングを売っていない。
     ホームに札を出さないだけでは、住所を直接打てば開けてしまう。
     開けると、あの店の利用規約が対象にしていないものを（第2章から先は
     有料で）売ることになる。/train も同じ（src/app/train/page.tsx）。 */
  if (!BRAND.training) notFound();
  const may = await canTrain();
  /* ログインしていない人だけ、ここで止める */
  if (!may.ok && may.why === "signin") return <NeedTrain why="signin" />;
  return <>{children}</>;
}
