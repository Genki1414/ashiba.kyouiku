import { TrainOrderClient } from "./TrainOrderClient";

/* 実務トレーニング（第2章から先）の申し込み。本人が申し込む */
export const revalidate = 3600;

export default function TrainOrderPage() {
  return <TrainOrderClient />;
}
