import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { currentUser } from "@/lib/supabase/session";
import { invoicesFor } from "@/lib/invoiceAccess";
import { findCourse } from "@/content/courses";

/* 買った側の、請求書の一覧。

   ホームの「請求書が届いています」は、払っていないものしか出さない。
   払ったあとに請求書を開く道が無かった（げんきさん 2026-09-09）。
   経理に出す・控えを取る、は払ったあとにやること。

   見られるのは、自分が申し込んだ注文と、自分の事業者の注文だけ。
   **会社は画面から受け取らない**（ログインしている人の会社を使う）。 */

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }
  const admin = await currentAdmin();
  const r = await invoicesFor(supabase, { userId: me.id, companyId: admin?.companyId ?? null });
  if (!r.ok) {
    /* 読めなかったことを「0件」に化けさせない（docs/100） */
    return NextResponse.json(
      {
        ok: false,
        reason:
          `請求書を読めませんでした（${r.reason}）。` +
          "データベースの版が古いときは、Supabase の SQL Editor に " +
          "supabase/apply-all.sql を貼って実行してください。",
      },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    admin: !!admin,
    list: r.list.map((e) => ({
      ...e,
      /* 講座の名前は画面で引かせない（講座が増えたときに画面が古いままになる） */
      items: e.items.map((it) => ({ ...it, short: findCourse(it.courseId)?.short ?? it.courseId })),
    })),
  });
}
