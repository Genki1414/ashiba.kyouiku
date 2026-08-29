import { type NextRequest } from "next/server";
import { confirmTo } from "@/lib/authConfirm";

/* 合言葉の決め直しのメールの戻り先。

   /auth/confirm と分けてある。いまの作り（PKCE）のリンクには
   code しか付いてこないので、中身を見ても「決め直しかどうか」が
   分からない。分からないまま中へ通すと、決め直さないまま入ってしまい、
   次に閉じたときにまた入れなくなる。道で分ける。 */
export async function GET(req: NextRequest) {
  return confirmTo(req, "/login/new");
}
