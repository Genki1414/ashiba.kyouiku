import { type NextRequest } from "next/server";
import { confirmTo } from "@/lib/authConfirm";

/* 登録の確認メールの戻り先。合図をログインに引き換えて、中へ通す。 */
export async function GET(req: NextRequest) {
  return confirmTo(req, "/");
}
