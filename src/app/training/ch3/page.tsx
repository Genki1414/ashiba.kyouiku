import { canTrain } from "@/lib/training";
import { NeedTrain } from "@/components/NeedTrain";

import { Ch3Client } from "./Ch3Client";

/* 第3章。?mode=honban で本番（親方に聞けない） */
export default async function Ch3Page({
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
  return <Ch3Client tutorial={mode !== "honban"} />;
}
