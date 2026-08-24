import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { CHAPTERS } from "@/training/chapters";
import { PASS } from "@/training/score";

/* 実務トレーニングを1回通し終えたときの記録。

   端末にも残す（間違いノートと章の一覧はそちらを見る）が、
   教育担当者から見えるようにサーバにも1行足す。
   Supabase が未設定なら mode:"local" を返し、画面は端末だけで進む。 */

type Body = {
  chapter?: string;
  tutorial?: boolean;
  sk?: boolean;
  skill?: number;
  score?: number;
  sec?: number;
  hints?: number;
  asks?: number;
  errs?: { tag: string; message: string; why: string }[];
};

const num = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0;

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const who = supabase ? await currentEnrollment() : null;
  if (!supabase || !who) {
    return NextResponse.json({ ok: true, mode: "local" });
  }

  const b = (await req.json().catch(() => ({}))) as Body;
  const chapter = CHAPTERS.find((c) => c.id === b.chapter)?.id;
  if (!chapter) {
    return NextResponse.json({ ok: false, reason: "章が分かりません。" }, { status: 400 });
  }

  const skill = num(b.skill, 100);
  const { error } = await supabase.from("training_attempts").insert({
    enrollment_id: who.enrollmentId,
    chapter,
    tutorial: b.tutorial === true,
    sk: b.sk === true,
    skill,
    score: num(b.score, 10_000_000),
    sec: num(b.sec, 24 * 60 * 60),
    hints: num(b.hints, 9999),
    asks: num(b.asks, 9999),
    /* 合否はサーバで決める。クライアントの言い分は見ない */
    passed: skill >= PASS,
    errs: Array.isArray(b.errs) ? b.errs.slice(0, 100) : [],
  });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mode: "supabase" });
}
