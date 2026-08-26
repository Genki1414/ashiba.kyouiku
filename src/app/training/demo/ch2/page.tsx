import { canTrain } from "@/lib/training";
import { NeedTrain } from "@/components/NeedTrain";

import { Demo2Client } from "./Demo2Client";

/* 第2章の通し見学 */
export default async function Demo2Page() {
/* 第2章から先は、利用権を持っている人だけ。
   画面を隠すのではなく、ここで止めて中身を作らない。
   作ってしまうと、手順がそのまま返ってしまう */
  const may = await canTrain();
  if (!may.ok) return <NeedTrain why={may.why} />;

  return <Demo2Client />;
}
