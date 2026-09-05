import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentOwner } from "@/lib/owner";
import { checkRoom, checkSlots, sortQueue, waitingCount, type SlotIn } from "@/lib/issue";
import { queue } from "@/lib/issueQuery";
import { myLive, doneOf, mySessions } from "@/lib/liveQuery";
import { findCourse } from "@/content/courses";
import { addNotice } from "@/lib/notice.server";

/* 発行申請（本部の側）。

   GET  … 申請の一覧。待たせている人が上
   POST … 候補日を出す／通す／断る

   候補日を出すのは本部だけ。受講する人には作らせない。
   作らせると、講師の都合と関係なく日が入る。

   誰が本部かは環境変数 OWNER_EMAILS で決めてある。
   データベースに持たせない（担当者の画面から自分を昇格させる道ができる）。 */

async function guard(): Promise<{ email: string } | NextResponse> {
  const email = await currentOwner();
  if (!email) {
    return NextResponse.json({ ok: false, reason: "本部だけの画面です。" }, { status: 403 });
  }
  return { email };
}

export async function GET() {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }

  const rows = await queue(supabase);

  /* 討議が済んだかどうかは、こちらで判定して見せる。
     本部が「済んだ人」を探して回らなくて済むように。
     判定そのものは受講と同じ決まり（judgeTalk）を使う */
  const picked = rows.filter((r) => r.status === "picked" && r.sessionId);
  /* つなぎ先が入っているか。URL そのものは返さない
     （本部の画面とはいえ、一覧に部屋の場所を並べない） */
  const hasRoom = new Set<string>();
  if (picked.length) {
    const { data: rs } = await supabase
      .from("live_sessions")
      .select("id, room_url")
      .in("id", [...new Set(picked.map((r) => r.sessionId as string))]);
    for (const x of rs ?? []) if (`${x.room_url ?? ""}`.trim()) hasRoom.add(x.id as string);
  }
  /* 実技の実施記録。**中身（data）はここでは読まない。**
     写真を200件ぶん一覧に載せると、開くだけで何十MBにもなる。
     ここでは「何が付いているか」だけを出し、
     中身は開いたときに1件ずつ取りに行く（/api/owner/issue/file） */
  const filesBy = new Map<string, { id: string; name: string; mime: string; bytes: number }[]>();
  const drillIds = rows.filter((r) => r.kind === "drill").map((r) => r.id);
  if (drillIds.length) {
    const { data: fs } = await supabase
      .from("cert_request_files")
      .select("id, request_id, filename, mime, size_bytes")
      .in("request_id", drillIds)
      .order("uploaded_at", { ascending: true });
    for (const f of fs ?? []) {
      const k = f.request_id as string;
      const list = filesBy.get(k) ?? [];
      list.push({
        id: f.id as string,
        name: (f.filename as string) ?? "",
        mime: (f.mime as string) ?? "",
        bytes: (f.size_bytes as number) ?? 0,
      });
      filesBy.set(k, list);
    }
  }

  const doneBy = new Map<string, { min: number; ok: boolean; why: string | null }>();
  if (picked.length) {
    const sessions = await mySessions(supabase, [
      ...new Set(picked.map((r) => r.sessionId as string)),
    ]);
    const byId = new Map(sessions.map((s) => [s.id, s]));
    for (const r of picked) {
      const ses = byId.get(r.sessionId as string);
      if (!ses) continue;
      const mine = await myLive(supabase, r.userId);
      const m = mine.get(ses.id);
      if (!m) continue;
      const d = doneOf(m, ses.minutes);
      doneBy.set(r.id, { min: d.min, ok: d.ok, why: d.ok ? null : d.why });
    }
  }

  return NextResponse.json({
    ok: true,
    waiting: waitingCount(rows),
    requests: sortQueue(rows).map((r) => ({
      id: r.id,
      courseId: r.courseId,
      course: findCourse(r.courseId)?.short ?? r.courseId,
      kind: r.kind,
      status: r.status,
      name: r.name,
      email: r.email,
      company: r.company,
      note: r.note,
      requestedAt: r.requestedAt,
      drillOn: r.drillOn,
      drillBy: r.drillBy,
      replyNote: r.replyNote,
      repliedAt: r.repliedAt,
      sessionId: r.sessionId,
      decidedAt: r.decidedAt,
      slots: r.slots,
      talk: doneBy.get(r.id) ?? null,
      /* 実技の実施記録。無ければ通せない（0027 が止める） */
      files: filesBy.get(r.id) ?? [],
      hasRoom: r.sessionId ? hasRoom.has(r.sessionId) : false,
    })),
  });
}

type Body =
  | { action: "offer"; requestId: string; slots: SlotIn[]; note?: string }
  | { action: "clear"; requestId: string; note?: string }
  | { action: "decline"; requestId: string; note: string }
  | { action: "room"; requestId: string; url: string };

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase が未設定です。" }, { status: 503 });
  }
  const b = (await req.json().catch(() => ({}))) as Partial<Body>;
  const id = (b.requestId ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, reason: "どの申請か分かりません。" }, { status: 400 });
  }

  /* 誰の、どの講座の申請か。返事のたびに本人へ知らせるので、
     どの返事でも要る。ここで1回だけ読む */
  const { data: reqRow } = await supabase
    .from("cert_requests")
    .select("user_id, course_id, session_id")
    .eq("id", id)
    .maybeSingle();
  const to = (reqRow?.user_id as string | null) ?? null;
  const courseId = (reqRow?.course_id as string | null) ?? null;

  if (b.action === "offer") {
    /* 過ぎた日・重なった日・多すぎる候補は、ここで弾く。
       出してしまうと、選べない候補が本人の画面に並ぶ */
    const v = checkSlots(Array.isArray(b.slots) ? b.slots : []);
    if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 400 });
    const { error } = await supabase.rpc("offer_slots", {
      p_request: id,
      p_slots: v.slots,
      p_note: (b.note ?? "").trim().slice(0, 1000),
      p_by: g.email,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    /* 待っているのは本人。出しただけでは伝わらない。
       添えた一言も返す（都合の付け方が書いてあることがある） */
    await addNotice(to, "slot", { courseId, note: b.note });
    return NextResponse.json({ ok: true, n: v.slots.length });
  }

  if (b.action === "clear") {
    const { error } = await supabase.rpc("clear_request", {
      p_request: id,
      p_note: (b.note ?? "").trim().slice(0, 1000),
      p_by: g.email,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    await addNotice(to, "pass", { courseId, note: b.note });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "room") {
    /* 討議の部屋（Zoom など）を、その回に入れる。
       一覧には出さない。当日「入る」を押した人にだけ渡る */
    const v = checkRoom(b.url ?? "");
    if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 400 });
    const ses = (reqRow?.session_id as string | null) ?? null;
    if (!ses) {
      return NextResponse.json(
        { ok: false, reason: "まだ日が決まっていません。日が決まってから入れてください。" },
        { status: 409 },
      );
    }
    const { error } = await supabase
      .from("live_sessions")
      .update({ room_url: v.url })
      .eq("id", ses);
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    /* 入り口の住所そのものは知らせに入れない。「決まった」とだけ返す。
       当日その画面から入れる（住所は回のほうに入っている） */
    await addNotice(to, "room", { courseId });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "decline") {
    const note = (b.note ?? "").trim();
    if (!note) {
      return NextResponse.json(
        { ok: false, reason: "断る理由を書いてください。相手に返ります。" },
        { status: 400 },
      );
    }
    const { error } = await supabase.rpc("decline_request", {
      p_request: id,
      p_note: note.slice(0, 1000),
      p_by: g.email,
    });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 409 });
    /* 理由をそのまま返す。理由の無い「断られました」では、
       受け取った人が次に何をすればいいか分からない */
    await addNotice(to, "issue_ng", { courseId, note });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "その操作は分かりません。" }, { status: 400 });
}
