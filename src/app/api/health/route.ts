import { NextResponse } from "next/server";
import { getServiceClient, getDevEnrollmentId } from "@/lib/supabase/server";

/* 接続確認。/setup 画面がこれを見て、何が足りないかを表示する。
   鍵そのものは返さない（設定されているかどうかだけ）。 */

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const enrollmentId = getDevEnrollmentId();
  const supabase = getServiceClient();

  /* Vercel 上か手元か。手順の出し分けに使う（VERCEL は Vercel が自動で入れる） */
  const host: "vercel" | "local" = process.env.VERCEL ? "vercel" : "local";

  const env = {
    url: url ? url.replace(/^https:\/\/([^.]{4})[^.]*/, "https://$1…") : null,
    anonKey: hasAnon,
    serviceKey: hasService,
    devEnrollmentId: !!enrollmentId,
    examSecret: !!process.env.EXAM_SECRET,
  };

  if (!supabase || !enrollmentId) {
    return NextResponse.json({
      mode: "local",
      host,
      env,
      message: "Supabase 未設定です。視聴記録はブラウザ内（localStorage）に保存されます。",
    });
  }

  const checks: Record<string, { ok: boolean; detail: string }> = {};
  const check = async (name: string, fn: () => Promise<string>) => {
    try {
      checks[name] = { ok: true, detail: await fn() };
    } catch (e) {
      checks[name] = { ok: false, detail: e instanceof Error ? e.message : "失敗" };
    }
  };

  await check("lessons", async () => {
    const { count, error } = await supabase
      .from("lessons")
      .select("lesson_id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    if (count !== 13) throw new Error(`${count} 件（13件のはず）。apply-all.sql を実行してください`);
    return "13件";
  });

  await check("enrollment", async () => {
    const { data, error } = await supabase
      .from("enrollments")
      .select("id")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("DEV_ENROLLMENT_ID に対応する受講がありません");
    return "あり";
  });

  await check("rpc", async () => {
    // 0秒の同期。加算されないので記録は汚れない
    const { error } = await supabase.rpc("sync_watched_sec", {
      p_enrollment_id: enrollmentId,
      p_lesson_id: "1-1",
      p_delta_sec: 0,
    });
    if (error) throw new Error(error.message);
    return "sync_watched_sec 応答あり";
  });

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({
    mode: ok ? "supabase" : "error",
    host,
    env,
    checks,
    message: ok
      ? "Supabase に接続できています。視聴記録・照合ログ・受験記録はサーバに保存されます。"
      : "接続はできましたが、初期化が終わっていません。supabase/apply-all.sql を SQL Editor で実行してください。",
  });
}
