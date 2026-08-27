import { canTrain } from "@/lib/training";
import { Ch1Client } from "./Ch1Client";

/* 第1章。誰でも遊べる（試し）。
   ?mode=honban で本番（手順書なし・親方に聞けない・ゴーストが薄い）
   ?sk=1 で手摺先行工法（先行手摺を使う段取り）

   通し終えた画面に「つぎは第2章」を出すので、
   その人に第2章が開いているかどうかをここで見て渡す。
   結果の画面はクライアント側なので、あちらでは見られない。 */
export default async function Ch1Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; sk?: string }>;
}) {
  const [{ mode, sk }, may] = await Promise.all([searchParams, canTrain()]);
  return <Ch1Client tutorial={mode !== "honban"} sk={sk === "1"} nextLocked={!may.ok} />;
}
