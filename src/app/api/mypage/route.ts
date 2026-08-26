import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/supabase/session";
import { readyCourses, lessonKey } from "@/content/courses";
import { getLessonList } from "@/lib/curriculum";

/* マイページの中身。受講者が自分のことを見る所。

   ・自分の氏名と生年月日（修了証に載るので、ここで直せる）
   ・いまの所属（在籍中／許可待ち／どこにも属していない）
   ・講座ごとの進み具合と修了証

   自分のことしか返さない。誰かの id を受け取ったりしない。 */

type Body = { name?: string; birth?: string };

export async function GET() {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  /* 聞ける順にまとめて聞く。上から順に await すると、
     マイページを開くだけで Supabase まで5〜6往復する */
  const [{ data: me }, { data: mem }, { data: ens }] = await Promise.all([
    supabase
      .from("users")
      .select("name, email, birth_date, role, company_id")
      .eq("id", user.id)
      .maybeSingle(),
    /* 所属。許可が下りていなければ「許可待ち」 */
    supabase
      .from("memberships")
      .select("company_id, approved_at")
      .eq("user_id", user.id)
      .is("left_at", null),
    /* 講座ごとの進み具合。開いている受講だけを見る（取り消したものは数えない） */
    supabase
      .from("enrollments")
      .select("id, course_id, seat_id")
      .eq("user_id", user.id)
      .is("closed_at", null),
  ]);

  const rows = mem ?? [];
  const ids = rows.map((m) => m.company_id as string);
  const eids = (ens ?? []).map((e) => e.id as string);

  const [{ data: cos }, { data: prog }, { data: certs }, { data: exams }] = await Promise.all([
    ids.length
      ? supabase.from("companies").select("id, name").in("id", ids)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    eids.length
      ? supabase
          .from("progress")
          .select("enrollment_id, lesson_id, watched_sec, quiz_passed_at")
          .in("enrollment_id", eids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    eids.length
      ? supabase
          .from("certificates")
          .select("enrollment_id, cert_no, issued_at, revoked_at")
          .in("enrollment_id", eids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    eids.length
      ? supabase.from("exams").select("enrollment_id, passed").in("enrollment_id", eids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const nameOf = new Map((cos ?? []).map((c) => [c.id as string, c.name as string]));
  const joined = rows.find((m) => m.approved_at);
  const member = joined
    ? {
        state: "active" as const,
        company: { id: joined.company_id as string, name: nameOf.get(joined.company_id as string) ?? "" },
      }
    : rows.length
      ? {
          state: "pending" as const,
          pending: rows.map((m) => ({
            id: m.company_id as string,
            name: nameOf.get(m.company_id as string) ?? "",
          })),
        }
      : { state: "none" as const };

  const learning = [];
  for (const c of readyCourses()) {
    const en = (ens ?? []).find((e) => e.course_id === c.id);
    const lessons = await getLessonList(c.id);
    const requiredSec = lessons.reduce((n, l) => n + l.legal_min * 60, 0);
    if (!en) {
      learning.push({
        courseId: c.id, name: c.name, short: c.short,
        started: false, lessonsPassed: 0, lessonsTotal: lessons.length,
        watchedSec: 0, requiredSec, examPassed: false, cert: null, hasSeat: false,
      });
      continue;
    }
    const mine = (prog ?? []).filter((p) => p.enrollment_id === en.id);
    /* 単元IDは「講座:番号」。その講座のぶんだけ数える */
    const keys = new Set(lessons.map((l) => lessonKey(c.id, l.id)));
    const passed = mine.filter((p) => p.quiz_passed_at && keys.has(p.lesson_id as string)).length;
    const cert = (certs ?? []).find((x) => x.enrollment_id === en.id && !x.revoked_at) ?? null;
    learning.push({
      courseId: c.id,
      name: c.name,
      short: c.short,
      started: true,
      lessonsPassed: passed,
      lessonsTotal: lessons.length,
      watchedSec: mine.reduce((n, p) => n + ((p.watched_sec as number) ?? 0), 0),
      requiredSec,
      examPassed: (exams ?? []).some((x) => x.enrollment_id === en.id && x.passed),
      cert: cert ? { no: cert.cert_no as string, at: cert.issued_at as string } : null,
      hasSeat: !!en.seat_id,
    });
  }

  return NextResponse.json({
    ok: true,
    name: (me?.name as string) ?? "",
    email: (me?.email as string) ?? user.email ?? "",
    birth: (me?.birth_date as string) ?? "",
    admin: me?.role === "admin",
    member,
    learning,
  });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const user = supabase ? await currentUser() : null;
  if (!supabase || !user) {
    return NextResponse.json({ ok: false, reason: "ログインが要ります。" }, { status: 403 });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const patch: Record<string, string> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim();
  const d = b.birth ? Date.parse(b.birth) : NaN;
  if (!Number.isNaN(d)) patch.birth_date = new Date(d).toISOString().slice(0, 10);
  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, reason: "直すものがありません。" }, { status: 400 });
  }

  const { error } = await supabase.from("users").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
