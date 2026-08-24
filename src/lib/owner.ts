import { currentUser } from "./supabase/session";

/* 運営（この教材を売っている側）かどうか。

   受講する会社の教育担当者とは別。
   運営は、どの事業者の注文も見られて、請求書払いの入金を確認できる。

   誰が運営かは Vercel の環境変数 OWNER_EMAILS（コンマ区切り）で決める。
   データベースに持たせない。持たせると、担当者の画面から
   自分を運営に昇格させる道ができてしまう。 */

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return ownerEmails().includes(e);
}

/** いまログインしている人が運営なら、そのメール。違えば null */
export async function currentOwner(): Promise<string | null> {
  const user = await currentUser();
  if (!user?.email) return null;
  return isOwnerEmail(user.email) ? user.email : null;
}
