import { Suspense } from "react";
import { LoginClient } from "./LoginClient";

/* ログイン。Supabase を設定していないあいだは、この画面は使われない
   （middleware がログインを求めない） */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
