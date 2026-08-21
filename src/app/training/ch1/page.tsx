import { Ch1Client } from "./Ch1Client";

/* 第1章。?mode=honban で本番（手順書なし・親方に聞けない・ゴーストが薄い） */
export default async function Ch1Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <Ch1Client tutorial={mode !== "honban"} />;
}
