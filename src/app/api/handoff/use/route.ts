import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getSessionClient } from "@/lib/supabase/session";
import { isHandoff, normalizeHandoff } from "@/lib/handoff";

/* 引き換えコードを使って、この端末にログインを立てる（0036）。

   **ここは、入っていない人が叩く。**だから見張りはコードそのもの。
   コードは1回きり・5分で切れる（SQL の use_handoff が消す）。

   ── 決めたこと ──
   ・**断り方を分けない。**「そんなコードは無い」「切れている」を
     書き分けると、当てずっぽうに手がかりを与える
   ・合図の作り方は LINE ログインと同じ（generateLink → verifyOtp）。
     **メールは送らない**（届かない住所のことがある） */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = normalizeHandoff(typeof body.code === "string" ? body.code : "");
  if (!isHandoff(code)) {
    return NextResponse.json({ ok: false, reason: "コードを確かめてください。" }, { status: 400 });
  }

  const admin = getServiceClient();
  const session = await getSessionClient();
  if (!admin || !session) {
    return NextResponse.json({ ok: false, reason: "接続の設定がありません。" }, { status: 503 });
  }

  const { data: userId, error } = await admin.rpc("use_handoff", { p_code: code });
  if (error || typeof userId !== "string") {
    return NextResponse.json(
      { ok: false, reason: "そのコードは使えません。ブラウザで作り直してください。" },
      { status: 403 },
    );
  }

  /* 誰のものかを引く。メールが要る（合図はメールに対して作る） */
  const { data: who , error: whoErr } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (whoErr) return NextResponse.json({ ok: false, reason: `登録を読めませんでした（${whoErr.message}）` }, { status: 500 });
  const email = ((who?.email as string | null) ?? "").trim();
  if (!email) {
    return NextResponse.json({ ok: false, reason: "この方のログインを作れません。" }, { status: 500 });
  }

  const { data: link, error: genErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hash = link?.properties?.hashed_token;
  if (genErr || !hash) {
    return NextResponse.json({ ok: false, reason: "ログインを作れませんでした。" }, { status: 500 });
  }

  const { error: otpErr } = await session.auth.verifyOtp({ type: "magiclink", token_hash: hash });
  if (otpErr) {
    return NextResponse.json({ ok: false, reason: "ログインを作れませんでした。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
