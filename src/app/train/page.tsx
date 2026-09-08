import { notFound } from "next/navigation";
import { TrainOrderClient } from "./TrainOrderClient";
import { BRAND } from "@/content/brand";

/* 実務トレーニング（第2章から先）の申し込み。本人が申し込む */
export const revalidate = 3600;

export default function TrainOrderPage() {
  /* **売っていない店では出さない。**ここは申し込みの画面なので、
     開けたままにすると、規約が対象にしていない物を売ってしまう
     （src/app/training/layout.tsx と同じ理由） */
  if (!BRAND.training) notFound();
  return <TrainOrderClient />;
}
