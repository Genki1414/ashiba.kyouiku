import { Ch1Client } from "./Ch1Client";

/* 第1章。
   ?mode=honban で本番（手順書なし・親方に聞けない・ゴーストが薄い）
   ?sk=1 で手摺先行工法（先行手摺を使う段取り） */
export default async function Ch1Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; sk?: string }>;
}) {
  const { mode, sk } = await searchParams;
  return <Ch1Client tutorial={mode !== "honban"} sk={sk === "1"} />;
}
