import { canTrain } from "@/lib/training";
import { NeedTrain } from "@/components/NeedTrain";

import { Ch2Client } from "./Ch2Client";

/* 第2章。?mode=honban で本番（手順書なし・親方に聞けない） */
export default async function Ch2Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
/* 第2章から先は、利用権を持っている人だけ。
   画面を隠すのではなく、ここで止めて中身を作らない。
   作ってしまうと、手順がそのまま返ってしまう */
  const may = await canTrain();
  if (!may.ok) return <NeedTrain why={may.why} />;

  const { mode } = await searchParams;
  return <Ch2Client tutorial={mode !== "honban"} />;
}
