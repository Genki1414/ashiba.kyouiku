import { Ch3Client } from "./Ch3Client";

/* 第3章。?mode=honban で本番（親方に聞けない） */
export default async function Ch3Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <Ch3Client tutorial={mode !== "honban"} />;
}
