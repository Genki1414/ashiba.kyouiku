import { getServiceClient } from "./supabase/server";
import { currentUser } from "./supabase/session";
import { trainFor, type TrainMay } from "./trainingGate";

/* 実務トレーニングを、いまログインしている人について見る。
   決まりそのものは trainingGate.ts。 */

export type { TrainMay };
export { FREE_CHAPTERS, isFreeChapter } from "./trainingGate";

export async function canTrain(): Promise<TrainMay> {
  const supabase = getServiceClient();
  /* Supabase を繋いでいないあいだは、ログインも求めていない（手元で動かすとき）。
     ここで止めると何も開けなくなるので、そのまま通す */
  if (!supabase) return { ok: true, by: "open" };

  const user = await currentUser();
  if (!user) return { ok: false, why: "signin" };

  return trainFor(supabase, user.id);
}
