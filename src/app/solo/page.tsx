import { SoloClient } from "./SoloClient";

/* ひとりで受ける（0039）。本人が、自分の受講コードを申し込む。
   会社の登録も担当者も要らない。値段はサーバが返す（/api/solo） */
export const metadata = { title: "ひとりで受ける" };

export default function SoloPage() {
  return <SoloClient />;
}
