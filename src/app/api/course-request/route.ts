import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { findCourse, readyCourses } from "@/content/courses";

/* 受講リクエスト。本人が「この講座を受けたい」を教育担当者に送る。

   席（受講コード）は担当者が用意する。ここは、それを頼む声を
   画面に残すだけ。自分のぶんしか触らない。会社の番号も
   画面から受け取らない（いま在籍している会社に、DB側で決める）。 */

type Body = { courseId?: string; action?: "request" | "cancel" };

/* 受講コードを入れる画面（/join）が読む。

   コードを渡されていない人が開くのがあの画面で、そこに立った人が
   いちばん「誰に言えばいいのか」で詰まる。だから講座の一覧と、
   もう送ってあるか・もう席があるかを、あそこでも出せるようにする。

   マイページ（/api/mypage）でも同じことが分かるが、あちらは受講の
   進み具合まで数えるので重い。ここは名前と印だけを返す。 */
export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "ログインが必要です。" }, { status: 403 });
  }

  /* いま在籍しているか。していなければ、誰宛か決まらないので送れない。
     画面には「送れない理由」を出したいので、false を返して伝える */
  const { data: mem , error: memErr } = await supabase
    .from("memberships")
    .select("company_id, companies(name)")
    .eq("user_id", user.id)
    .not("approved_at", "is", null)
    .is("left_at", null)
    .limit(1);
  if (memErr) return NextResponse.json({ ok: false, reason: `在籍を読めませんでした（${memErr.message}）` }, { status: 500 });
  const m = (mem ?? [])[0] as { company_id?: string; companies?: { name?: string } } | undefined;

  const [{ data: creqs }, { data: ens }] = await Promise.all([
    supabase.from("course_requests").select("course_id").eq("user_id", user.id).is("handled_at", null),
    supabase.from("enrollments").select("course_id, seat_id").eq("user_id", user.id),
  ]);
  const sent = new Set((creqs ?? []).map((r) => r.course_id as string));
  const seated = new Set((ens ?? []).filter((e) => e.seat_id).map((e) => e.course_id as string));

  return NextResponse.json({
    ok: true,
    member: m?.company_id ? { state: "active" as const, company: m.companies?.name ?? "" }
                          : { state: "none" as const },
    courses: readyCourses().map((c) => ({
      courseId: c.id,
      name: c.name,
      short: c.short,
      requested: sent.has(c.id),
      hasSeat: seated.has(c.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "ログインが必要です。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const courseId = typeof b.courseId === "string" ? b.courseId.trim() : "";
  if (!courseId || !findCourse(courseId)) {
    return NextResponse.json({ ok: false, reason: "どの講座か分かりません。" }, { status: 400 });
  }

  if (b.action === "cancel") {
    const { error } = await supabase.rpc("cancel_course_request", {
      p_user: user.id,
      p_course: courseId,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.rpc("request_course", {
    p_user: user.id,
    p_course: courseId,
  });
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
