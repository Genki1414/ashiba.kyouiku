import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { buildCheck, checkTotals, type RawLog } from "@/training/verifyLog";

/* 照合の記録を、教育担当者に返す。

   これは「本人が受けた証拠」。監督署や元請に聞かれたときに
   事業者が出すものなので、自社の受講者ぶんだけを返す。
   判断は画面ではなくここで行う。 */

/** 1人あたり、明細を何件まで出すか */
const PER_USER = 50;
/** まとめて読む上限。多い会社で重くならないように */
const MAX_ROWS = 5000;

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const admin = supabase ? await currentAdmin() : null;
  if (!supabase || !admin) {
    return NextResponse.json({ ok: false, reason: "教育担当者だけの画面です。" }, { status: 403 });
  }

  /* 何日ぶんを見るか。既定は90日 */
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 90));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("company_id", admin.companyId);
  const ids = (users ?? []).map((u) => u.id as string);
  if (!ids.length) {
    return NextResponse.json({
      ok: true, company: admin.companyName, days,
      rows: [], totals: checkTotals([]),
    });
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, user_id")
    .in("user_id", ids);
  const eids = (enrollments ?? []).map((e) => e.id as string);

  let logs: RawLog[] = [];
  if (eids.length) {
    const { data } = await supabase
      .from("verify_logs")
      .select("enrollment_id, lesson_id, result, reason, created_at")
      .in("enrollment_id", eids)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    logs = (data ?? []) as unknown as RawLog[];
  }

  const rows = buildCheck({
    users: (users ?? []) as never,
    enrollments: (enrollments ?? []) as never,
    logs,
    limit: PER_USER,
  });

  return NextResponse.json({
    ok: true,
    company: admin.companyName,
    days,
    /* 上限に当たっていれば、古い分が落ちていると分かるようにする */
    capped: logs.length >= MAX_ROWS,
    rows,
    totals: checkTotals(rows),
  });
}
