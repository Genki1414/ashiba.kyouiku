import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { newJoinCode } from "@/training/joinCode";

/* 事業者の設定。教育担当者だけ。
   ・修了証に載せる名義（事業者名・教育実施責任者）
   ・参加コードの配り直し（漏れたときに新しくする） */

type Body = { name?: string; responsible?: string; newCode?: boolean };

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの操作です。" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const patch: Record<string, string | null> = {};

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) {
      return NextResponse.json({ ok: false, reason: "事業者名は空にできません。" }, { status: 400 });
    }
    patch.name = v;
  }
  if (typeof body.responsible === "string") {
    patch.responsible_name = body.responsible.trim() || null;
  }

  if (body.newCode) {
    /* まれにぶつかる。ぶつかったら取り直す */
    for (let i = 0; i < 5; i++) {
      const code = newJoinCode();
      const { error } = await supabase
        .from("companies")
        .update({ ...patch, join_code: code })
        .eq("id", admin.companyId);
      if (!error) return NextResponse.json({ ok: true, joinCode: code });
      if (!`${error.message}`.includes("join_code")) {
        return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: false, reason: "作れませんでした。" }, { status: 500 });
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, reason: "直すものがありません。" }, { status: 400 });
  }
  const { error } = await supabase.from("companies").update(patch).eq("id", admin.companyId);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
