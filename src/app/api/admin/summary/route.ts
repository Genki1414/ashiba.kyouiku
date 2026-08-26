import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { canCreateCompany, currentAdmin } from "@/lib/admin";
import { currentUser } from "@/lib/supabase/session";
import { buildRoster, mergePeople, peopleTotals } from "@/training/roster";
import { heldForMany } from "@/lib/quals";
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

  /* ── ここから先は、聞ける順にまとめて聞く ──
     素直に上から順に await すると、Supabase まで18往復する。
     東京から100msでも2秒近く待たされる。担当者は毎日開くので、
     そこが「名簿が遅い」になる。

     ・在籍は4回に分けて引いていた（在籍・申し込み・断った・内訳）。
       会社ぶんを1回引いて、こちらで分ける
     ・受講も、人を決めてから引き直していた。
       会社で絞れば人は要らないので、先に引ける
     ・席は、注文ぜんぶで1回引いて、入金済みかどうかで分ける */
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: myOrders }, { data: mems }, { data: past }, { data: openEnroll }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, status")
        .eq("company_id", admin.companyId)
        .eq("course_id", course.id),
      supabase
        .from("memberships")
        .select("user_id, requested_at, approved_at, left_at")
        .eq("company_id", admin.companyId),
      supabase.from("enrollments").select("user_id").eq("company_id", admin.companyId),
      supabase
        .from("enrollments")
        .select("id, user_id, course_id")
        .eq("company_id", admin.companyId)
        .is("closed_at", null),
    ]);

  const memberships = mems ?? [];
  const paidIds = new Set((myOrders ?? []).filter((o) => o.status === "paid").map((o) => o.id as string));
  const orderIds = (myOrders ?? []).map((o) => o.id as string);

  /* 名簿に出す人は2通り。
     ① いま在籍している人
     ② 抜けたが、この会社の席で受けた記録がある人（退職・転職）
     ②を消すと、その会社が「誰に受けさせたか」を後から示せなくなる

     在籍かどうかは「許可が下りていて、まだ抜けていない」で見る。
     left_at だけで見ると、**まだ許可していない申し込みまで在籍になる**。 */
  const activeIds = new Set(
    memberships.filter((m) => m.approved_at && !m.left_at).map((m) => m.user_id as string),
  );
  /* 参加の申し込み（まだ許可していない）。担当者がやることなので、先に返す */
  const waiting = memberships.filter((m) => !m.approved_at && !m.left_at);
  const wantIds = waiting.map((m) => m.user_id as string);
  /* 断った（または間違って閉じた）申し込み。
     押し間違いで消えたまま戻せないと、担当者はどうにもできない。
     近いものだけ出して、やり直せるようにする。
     いま申し込み直している人と、もう在籍している人は出さない。
     出すと、同じ人が「参加の申し込み」と「断った申し込み」の
     両方に並んで、二人居るように見える */
  const refused = memberships.filter(
    (m) => !m.approved_at && m.left_at && `${m.left_at}` >= since30,
  );
  const refIds = [...new Set(refused.map((m) => m.user_id as string))]
    .filter((id) => !wantIds.includes(id) && !activeIds.has(id));

  /* 在籍の内訳。「申し込んだはずの人が居ない」ときに、
     どこへ行ったのかが分からないと直しようがないので出しておく */
  const member = {
    active: activeIds.size,
    waiting: waiting.length,
    /* 抜けた人と、断った申し込み */
    gone: memberships.filter((m) => m.left_at).length,
  };

  /* 閉じた受講（取り消したもの）も、その会社と関わりがあった証なので
     名簿には出す。ただし進み具合は、開いている受講だけで見る */
  const allIds = [...new Set([...activeIds, ...(past ?? []).map((e) => e.user_id as string)])];

  /* 名前が要る人を、1回でまとめて引く。
     申し込み・断った申し込み・名簿で、3回に分けて引いていた */
  const needNames = [...new Set([...allIds, ...wantIds, ...refIds])];
  const allEnroll = openEnroll ?? [];
  const eids = allEnroll.map((e) => e.id as string);

  const pick = async (table: string, cols: string): Promise<Record<string, unknown>[]> => {
    if (!eids.length) return [];
    const { data } = await supabase.from(table).select(cols).in("enrollment_id", eids);
    return (data ?? []) as unknown as Record<string, unknown>[];
  };

  const [seatRows, { data: named }, progress, exams, attempts, certs] = await Promise.all([
    orderIds.length
      ? supabase.from("seats").select("order_id, used_by").in("order_id", orderIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    needNames.length
      ? supabase.from("users").select("id, name, email, role").in("id", needNames)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    pick("progress", "enrollment_id, lesson_id, watched_sec, quiz_passed_at"),
    pick("exams", "enrollment_id, score, total, passed, created_at"),
    pick("training_attempts", "enrollment_id, chapter, tutorial, skill, passed, created_at"),
    pick("certificates", "enrollment_id, cert_no, issued_at, revoked_at"),
  ]);

  /* 席は、注文ぜんぶで1回引いて、入金済みかどうかで分ける */
  const seatList = ((seatRows as { data?: Record<string, unknown>[] }).data ?? []) as Record<string, unknown>[];
  const seats = { total: 0, used: 0 };
  const paidSeats = { total: 0, used: 0 };
  for (const st of seatList) {
    seats.total++;
    if (st.used_by) seats.used++;
    if (paidIds.has(st.order_id as string)) {
      paidSeats.total++;
      if (st.used_by) paidSeats.used++;
    }
  }

  const byId = new Map((named ?? []).map((u) => [u.id as string, u as Record<string, unknown>]));
  const nameRow = (id: string) => ({
    userId: id,
    name: (byId.get(id)?.name as string) ?? "",
    email: (byId.get(id)?.email as string) ?? null,
  });

  const askedAt = new Map(waiting.map((m) => [m.user_id as string, m.requested_at as string]));
  const requests = wantIds
    .filter((id) => byId.has(id))
    .map((id) => ({ ...nameRow(id), at: askedAt.get(id) ?? null }));

  const refAt = new Map(refused.map((m) => [m.user_id as string, m.left_at as string]));
  const rejected = refIds
    .filter((id) => byId.has(id))
    .map((id) => ({ ...nameRow(id), at: refAt.get(id) ?? null }));

  /* 申し込み中の人は「在籍」でも「退職」でもない。
     受けた記録があれば名簿には並ぶが、退職と出してはいけない */
  const pendingIds = new Set(wantIds);
  const ids = allIds.filter((id) => byId.has(id));
  const users = ids.map((id) => ({
    ...(byId.get(id) as Record<string, unknown>),
    active: activeIds.has(id),
    pending: pendingIds.has(id),
  }));

  /* 画面に出すものは、名簿が空でも埋まっていても同じ形で返す。
     ここを2か所に分けて書くと、片方に足した項目がもう片方から抜ける。
     申し込みが担当者の画面に出なかったのは、それが理由だった */
  const base = {
    ok: true as const,
    company: admin.companyName,
    joinCode: admin.joinCode,
    seats: { total: seats.total, used: seats.used, paid: paidSeats.total },
    lessonsTotal,
    course: { id: course.id, short: course.short, name: course.name },
    courses,
    requests,
    rejected,
    member,
    /* 資格の申請。名簿が空なら当然0件だが、形は揃えておく */
    quals: [] as { userId: string; name: string; email: string | null; items: unknown[] }[],
  };

  if (!ids.length) {
    return NextResponse.json({ ...base, rows: [], totals: peopleTotals([]) });
  }

  /* 受講は「この会社の席で受けたもの」に限る（上でまとめて引いてある）。
     よその会社で受けた記録が、こちらの名簿に出てはいけない。
     講座で絞らないのは、1人が特別教育をいくつも受けるため */
  /* 取り消した修了証は「取得済み」に出さない */
  const live = certs.filter((c) => !c.revoked_at);

  /* 講座ごとに組み立ててから、人ごとにまとめ直す。
     講座ごとの組み立て（buildRoster）は、そのまま使う */
  const parts = await Promise.all(
    readyCourses().map(async (c) => {
      const ls = c.id === course.id ? lessons : await getLessonList(c.id);
      const mine = allEnroll.filter((e) => e.course_id === c.id);
      const keep = new Set(mine.map((e) => e.id as string));
      const only = (rows: Record<string, unknown>[]) =>
        rows.filter((r) => keep.has(r.enrollment_id as string));
      return {
        course: { id: c.id, short: c.short, name: c.name },
        rows: buildRoster({
          users: users as never,
          enrollments: mine as never,
          progress: only(progress) as never,
          exams: only(exams) as never,
          attempts: only(attempts) as never,
          certs: only(live) as never,
          lessons: ls,
        }),
      };
    }),
  );

  /* 抜けた人は名簿に出さない。
     いま働いていない人が毎日の名簿に並んでいても、担当者の邪魔になる。
     記録そのものは消していない。教育を行ったのはこの仕組みなので、
     退職者ぶんも含めた元帳は、担当者の画面の下と本部の画面から出せる */
  const rows0 = mergePeople(parts).filter((r) => !r.left);

  /* 取得済みの資格のうち、よそで取ったもの（自己申告）。
     この仕組みの記録ではないが、担当者が「誰を現場に出せるか」を
     見るのに要る。まとめて引く。人ごとに引くと、
     名簿の人数だけ問い合わせが増える */
  const held = await heldForMany(supabase, rows0.map((r) => r.userId));
  const rows = rows0.map((r) => ({ ...r, held: held.get(r.userId) ?? [] }));

  /* まだ確かめていない申請。担当者がやることなので、上に出す。
     出さないと、本人が入れたことに気づかれないまま埋もれる */
  const quals = rows
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      items: r.held.filter((h) => !h.confirmedAt),
    }))
    .filter((r) => r.items.length);

  return NextResponse.json({ ...base, rows, totals: peopleTotals(rows), quals });
}
