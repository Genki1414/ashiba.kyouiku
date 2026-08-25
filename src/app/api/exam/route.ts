import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getExamPool, getQuestionsByIds, EXAM_N, EXAM_PASS } from "@/lib/examPool";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { canLearn } from "@/lib/entitle";

/* 修了試験。
   GET  … プールから20問を無作為に選び、正解を除いて返す。
          出題の並びは HMAC 署名付きトークンで固定し、採点時に検証する。
   POST … クライアントの回答をサーバで採点。16問以上で合格。
          Supabase があれば exams へ記録（attempt はサーバ側で採番）。
   正解・採点をクライアントに置かないための作り。 */

const SECRET = process.env.EXAM_SECRET ?? "dev-only-exam-secret";
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2時間

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId") ?? "";
  /* 出題も売り物のうち。受講コードの無い人には出さない */
  const may = await canLearn();
  if (!may.ok) {
    return NextResponse.json({ error: "受講コードが要ります" }, { status: 403 });
  }
  const pool = await getExamPool(courseId);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const qs = a.slice(0, Math.min(EXAM_N, a.length));
  const payload = JSON.stringify({ course: courseId, ids: qs.map((q) => q.id), iat: Date.now() });
  const token = `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
  return NextResponse.json({
    token,
    pass: EXAM_PASS,
    questions: qs.map((q) => ({ q: q.q, a: q.a })), // 正解（ok）は含めない
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : null;
  const answers = Array.isArray(body?.answers) ? (body.answers as unknown[]) : null;
  if (!token || !answers) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const [p64, sig] = token.split(".");
  if (!p64 || !sig) return NextResponse.json({ error: "トークンが不正です" }, { status: 400 });
  const payload = Buffer.from(p64, "base64url").toString();
  if (sign(payload) !== sig) {
    return NextResponse.json({ error: "トークンの検証に失敗しました" }, { status: 400 });
  }
  const { course: courseId, ids, iat } = JSON.parse(payload) as { course: string; ids: string[]; iat: number };
  if (Date.now() - iat > TOKEN_TTL_MS) {
    return NextResponse.json({ error: "試験の有効時間を過ぎました。もう一度始めてください" }, { status: 400 });
  }
  const qs = await getQuestionsByIds(courseId, ids);
  if (!qs || answers.length !== qs.length) {
    return NextResponse.json({ error: "回答の形式が不正です" }, { status: 400 });
  }

  const detail = qs.map((q, i) => ({
    q: q.q,
    correct: q.a[q.ok],
    ok: answers[i] === q.ok,
  }));
  const score = detail.filter((d) => d.ok).length;
  const passed = score >= EXAM_PASS;

  // Supabase があれば受験記録を残す
  let mode: "supabase" | "local" = "local";
  let attempt = 1;
  const supabase = getServiceClient();
  const who = await currentEnrollment(courseId);
  const enrollmentId = who?.enrollmentId ?? null;
  if (supabase && enrollmentId) {
    const { count } = await supabase
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", enrollmentId);
    attempt = (count ?? 0) + 1;
    const { error } = await supabase.from("exams").insert({
      enrollment_id: enrollmentId,
      score,
      total: qs.length,
      passed,
      attempt,
    });
    if (!error) mode = "supabase";
  }

  return NextResponse.json({
    mode,
    score,
    total: qs.length,
    passRequired: EXAM_PASS,
    passed,
    attempt,
    // 復習用：間違えた問題は設問と正解を返す（合否確定後なので出してよい）
    wrong: detail.filter((d) => !d.ok).map(({ q, correct }) => ({ q, correct })),
  });
}
