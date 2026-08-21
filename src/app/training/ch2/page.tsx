import { Ch2Client } from "./Ch2Client";

/* 第2章。?mode=honban で本番（手順書なし・親方に聞けない） */
export default async function Ch2Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <Ch2Client tutorial={mode !== "honban"} />;
}
