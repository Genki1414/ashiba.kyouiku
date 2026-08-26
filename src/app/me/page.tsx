import { MeClient } from "./MeClient";

/* この画面はサーバ側で誰かを見ていない（中身は MeClient があとから聞く）。
   作り置きにしておけば、押した瞬間に枠が出る */
export const revalidate = 3600;

export default function MePage() {
  return <MeClient />;
}
