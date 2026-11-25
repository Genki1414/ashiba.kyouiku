import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify.server";
import { membershipEnabled, runDaily } from "@/lib/membership.server";

/* 会員制度の日次処理（0040・docs/120）。Vercel Cron が毎朝呼ぶ（vercel.json）。

   ・期限を過ぎたチケットを失効させる・契約の自動更新・解約の終了・滞納の停止
   ・翌月の会費の入金行を起こす（next_due_on が 10 日以内の有効な契約）。
     起こした件数ぶん、運営に「請求書を送ってください」と知らせる
   中身は runDaily（src/lib/membership.server.ts）。運営の画面からも同じものを手で回せる

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

  /* 失効・自動更新・解約の終了・滞納の停止・翌月の起票（docs/121） */
  const r = await runDaily(supabase);
  if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason }, { status: 500 });
  if (r.opened > 0) await notify("renewal", r.opened);

  return NextResponse.json({ ok: true, expired: r.expired, renewed: r.renewed, ended: r.ended, suspended: r.suspended, opened: r.opened, contracts: r.contracts });
}
