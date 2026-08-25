import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { canCreateCompany, currentAdmin } from "@/lib/admin";
import { currentUser } from "@/lib/supabase/session";
import { buildRoster, rosterTotals } from "@/training/roster";
import { seatCounts } from "@/lib/seats";
import { findCourse, readyCourses } from "@/content/courses";
import { getLessonList } from "@/lib/curriculum";

/* 教育担当者の画面に出す一覧。
   担当者でなければ何も返さない。画面の出し分けではなく、ここで止める。 */

export async function GET(req: NextRequest) {
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

  /* どの講座の名簿かを決める。指定が無ければ、いちばん上の講座 */
  const wanted = req.nextUrl.searchParams.get("courseId");
  const course = findCourse(wanted) ?? readyCourses()[0] ?? null;
  if (!course) {
    return NextResponse.json({ ok: false, reason: "講座がありません。" }, { status: 404 });
  }
  /* 単元は順番どおり。担当者の画面に「いま何番目の途中か」を出すため */
  const lessons = await getLessonList(course.id);
  const lessonsTotal = lessons.length;
  /* 画面の切り替え用に、受けられる講座を一緒に返す */
  const courses = readyCourses().map((c) => ({ id: c.id, short: c.short, name: c.name }));

  /* 受講コード（席）の残り。買った数が足りているかを担当者に見せる */
  const { data: myOrders } = await supabase
    .from("orders")
    .select("id, status")
    .eq("company_id", admin.companyId)
    .eq("course_id", course.id);
  const paidIds = (myOrders ?? []).filter((o) => o.status === "paid").map((o) => o.id as string);
  const orderIds = (myOrders ?? []).map((o) => o.id as string);
  const seats = await seatCounts(supabase, orderIds);
  const paidSeats = await seatCounts(supabase, paidIds);

  /* 名簿に出す人は2通り。
     ① いま在籍している人（memberships の left_at が空）
     ② 抜けたが、この会社の席で受けた記録がある人（退職・転職）
     ②を消すと、教育を行った事業者が記録を出せなくなる（3年保存の決まり） */
  const { data: active } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("company_id", admin.companyId)
    .is("left_at", null);
  const activeIds = new Set((active ?? []).map((m) => m.user_id as string));

  /* 参加の申し込み（まだ許可していない）。担当者がやることなので、先に返す */
  const { data: waiting } = await supabase
    .from("memberships")
    .select("user_id, requested_at")
    .eq("company_id", admin.companyId)
    .is("approved_at", null)
    .is("left_at", null);
  const wantIds = (waiting ?? []).map((m) => m.user_id as string);
  const { data: wantUsers } = wantIds.length
    ? await supabase.from("users").select("id, name, email").in("id", wantIds)
    : { data: [] as { id: string; name: string; email: string | null }[] };
  const askedAt = new Map((waiting ?? []).map((m) => [m.user_id as string, m.requested_at as string]));
  const requests = (wantUsers ?? []).map((u) => ({
    userId: u.id as string,
    name: (u.name as string) ?? "",
    email: (u.email as string) ?? null,
    at: askedAt.get(u.id as string) ?? null,
  }));

  const { data: past } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("company_id", admin.companyId);
  const allIds = [...new Set([...activeIds, ...(past ?? []).map((e) => e.user_id as string)])];

  const { data: users0 } = allIds.length
    ? await supabase.from("users").select("id, name, email, role").in("id", allIds)
    : { data: [] as { id: string; name: string; email: string | null; role: string }[] };
  const users = (users0 ?? []).map((u) => ({ ...u, active: activeIds.has(u.id as string) }));
  const ids = users.map((u) => u.id as string);
  if (!ids.length) {
    return NextResponse.json({
      ok: true,
      company: admin.companyName,
      joinCode: admin.joinCode,
      seats: { total: seats.total, used: seats.used, paid: paidSeats.total },
      rows: [],
      totals: rosterTotals([]),
      lessonsTotal,
      course: { id: course.id, short: course.short, name: course.name },
      courses,
      requests,
    });
  }

  /* 受講は「この会社の席で受けたもの」に限る。
     よその会社で受けた記録が、こちらの名簿に出てはいけない */
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, user_id")
    .in("user_id", ids)
    .eq("course_id", course.id)
    .eq("company_id", admin.companyId);
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
    pick("progress", "enrollment_id, lesson_id, watched_sec, quiz_passed_at"),
    pick("exams", "enrollment_id, score, total, passed, created_at"),
    pick("training_attempts", "enrollment_id, chapter, tutorial, skill, passed, created_at"),
    pick("certificates", "enrollment_id, cert_no, issued_at, revoked_at"),
  ]);

  const rows = buildRoster({
    users: users as never,
    enrollments: (enrollments ?? []) as never,
    progress: progress as never,
    exams: exams as never,
    attempts: attempts as never,
    /* 取り消したものは出さない */
    certs: certs.filter((c) => !c.revoked_at) as never,
    lessons,
  });

  return NextResponse.json({
    ok: true,
    company: admin.companyName,
    joinCode: admin.joinCode,
    seats: { total: seats.total, used: seats.used, paid: paidSeats.total },
    rows,
    totals: rosterTotals(rows),
    lessonsTotal,
  });
}
