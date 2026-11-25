import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify.server";
import { membershipEnabled, openDuePayments } from "@/lib/membership.server";

/* 会員制度の日次処理（0040・docs/120）。Vercel Cron が毎朝呼ぶ（vercel.json）。

   ・期限を過ぎたチケットを失効させる（expire_tickets）
   ・翌月の会費の入金行を起こす（next_due_on が 10 日以内の有効な契約）。
     起こした件数ぶん、運営に「請求書を送ってください」と知らせる

   ── 誰が呼べるか ──
   Vercel Cron は Authorization: Bearer <CRON_SECRET> を付けて来る。
   それが無い・合わないときは何もしない。authGate では開けてあるが、
   開けてあるのは「ログインのクッキーが無いから」で、合言葉で見張る。
   CRON_SECRET が未設定なら、誰も呼べない（開けっぱなしにしない）。

   二度呼ばれても二度起きない（open_contract_payment は月で一意、失効は残額 0 を見る）。 */
export async function GET(req: NextRequest) {
  if (!membershipEnabled()) return NextResponse.json({ ok: true, skipped: "disabled" });
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "合言葉が合いません。" }, { status: 401 });
  }
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });

  const { data: expired, error: eErr } = await supabase.rpc("expire_tickets");
  if (eErr) return NextResponse.json({ ok: false, reason: `失効の処理に失敗（${eErr.message}）` }, { status: 500 });

  const opened = await openDuePayments(supabase);
  if (!opened.ok) return NextResponse.json({ ok: false, reason: `請求の起票に失敗（${opened.reason}）` }, { status: 500 });
  if (opened.opened > 0) await notify("renewal", opened.opened);

  return NextResponse.json({ ok: true, expired: Number(expired) || 0, opened: opened.opened, contracts: opened.contracts });
}
