import { canLearn } from "@/lib/entitle";
import { NeedSeat } from "@/components/NeedSeat";

/* 毎回サーバで見張る。作り置き（静的生成）にすると、
   出来上がった教材の頁が、誰にでもそのまま返ってしまう */
export const dynamic = "force-dynamic";

/* 学科の入口の、外側の見張り。

   ここは講座が分からない（レイアウトなので URL の一部を受け取れない）。
   だから見るのは「受講コードを1枚でも持っているか」まで。

   **講座ごとの見張りは、この内側**（src/app/edu/[courseId]/layout.tsx）。
   そちらが本番で、ここは「1枚も持っていない人」を早く帰すためのもの。
   前はここだけで通していたので、足場の受講コードを1枚持っていれば
   73講座すべてが開いていた（げんきさん 2026-09-09）。 */

export default async function EduLayout({ children }: { children: React.ReactNode }) {
  const may = await canLearn();
  if (!may.ok) return <NeedSeat why={may.why} company={may.company} />;
  return <>{children}</>;
}
