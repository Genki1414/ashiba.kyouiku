import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { canCreateCompany, currentAdmin } from "@/lib/admin";
import { currentUser } from "@/lib/supabase/session";
import { getCurriculum } from "@/lib/curriculum";
import { buildRoster, rosterTotals } from "@/training/roster";

/* 教育担当者の画面に出す一覧。
   担当者でなければ何も返さない。画面の出し分けではなく、ここで止める。 */

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, mode: "local", reason: "Supabase がまだ設定されていません。" },
      { status: 503 },
    );
  }

  const admin = await currentAdmin();
  if (!admin) {
    /* まだどこの事業者にも属していない人は、自分の事業者を作れる */
    const fresh = await canCreateCompany();
    const user = await currentUser();
    return NextResponse.json(
      {
        ok: false,
        mode: "supabase",
        canSetup: fresh,
        signedIn: !!user,
        reason: fresh
          ? "まだ事業者が決まっていません。"
          : "教育担当者だけが見られる画面です。",
      },
      { status: 403 },
    );
  }

  const cur = await getCurriculum();
  const lessonsTotal = cur.subjects.reduce((n, s) => n + s.lessons.length, 0);

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("company_id", admin.companyId);
  const ids = (users ?? []).map((u) => u.id as string);
  if (!ids.length) {
    return NextResponse.json({
      ok: true,
      company: admin.companyName,
      responsible: admin.responsible,
      joinCode: admin.joinCode,
      rows: [],
      totals: rosterTotals([]),
      lessonsTotal,
    });
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, user_id")
    .in("user_id", ids);
  const eids = (enrollments ?? []).map((e) => e.id as string);

  const pick = async (
    table: string,
    cols: string,
  ): Promise<Record<string, unknown>[]> => {
    if (!eids.length) return [];
    const { data } = await supabase.from(table).select(cols).in("enrollment_id", eids);
    return (data ?? []) as unknown as Record<string, unknown>[];
  };

  const [progress, exams, attempts, certs] = await Promise.all([
    pick("progress", "enrollment_id, quiz_passed_at"),
    pick("exams", "enrollment_id, score, total, passed, created_at"),
    pick("training_attempts", "enrollment_id, chapter, tutorial, skill, passed, created_at"),
    pick("certificates", "enrollment_id, cert_no, issued_at, revoked_at"),
  ]);

  const rows = buildRoster({
    users: (users ?? []) as never,
    enrollments: (enrollments ?? []) as never,
    progress: progress as never,
    exams: exams as never,
    attempts: attempts as never,
    /* 取り消したものは出さない */
    certs: certs.filter((c) => !c.revoked_at) as never,
    lessonsTotal,
  });

  return NextResponse.json({
    ok: true,
    company: admin.companyName,
    responsible: admin.responsible,
    joinCode: admin.joinCode,
    rows,
    totals: rosterTotals(rows),
    lessonsTotal,
  });
}
