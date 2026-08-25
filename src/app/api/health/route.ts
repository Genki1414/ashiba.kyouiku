import { NextResponse } from "next/server";
import { getServiceClient, getDevEnrollmentId } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { currentUser } from "@/lib/supabase/session";
import { LATEST } from "@/content/changelog";
import { missingSeller } from "@/content/legal";
import { ownerEmails } from "@/lib/owner";

/* 接続確認。/setup 画面がこれを見て、何が足りないかを表示する。
   鍵そのものは返さない（設定されているかどうかだけ）。 */

/** この版のアプリが必要とするデータベースの版（supabase/migrations の最後の番号） */
const NEED_SCHEMA = "0009";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const devEnrollment = getDevEnrollmentId();
  const supabase = getServiceClient();
  const user = await currentUser();
  const who = await currentEnrollment();
  const enrollmentId = who?.enrollmentId ?? devEnrollment;

  /* Vercel 上か手元か。手順の出し分けに使う（VERCEL は Vercel が自動で入れる） */
  const host: "vercel" | "local" = process.env.VERCEL ? "vercel" : "local";

  const env = {
    url: url ? url.replace(/^https:\/\/([^.]{4})[^.]*/, "https://$1…") : null,
    anonKey: hasAnon,
    serviceKey: hasService,
    devEnrollmentId: !!devEnrollment,
    examSecret: !!process.env.EXAM_SECRET,
  };

  /* いま誰として記録しているか。鍵やメールの中身は返さない */
  const auth = {
    /* ログインを求める状態か（設定してあれば求める） */
    required: !!(url && hasAnon),
    signedIn: !!user,
    /* 記録の宛先が決まっているか */
    enrollment: who ? (user ? "本人" : "開発用") : "なし",
  };
  /* いま動いているのがどの版か。新しい版が届いているかを見る目印 */
  const appVersion = LATEST;

  /* 売るために要る設定。空のままだと売れない（特商法の表示義務・入金の確認） */
  const sell = {
    /* 運営の画面を開ける人。0人だと入金の確認ができない */
    owners: ownerEmails().length,
    /* 1人あたりの単価。未設定だと仮の値になる */
    unitPrice: !!process.env.SEAT_UNIT_PRICE,
    /* カード払い。無くても請求書払いで売れる */
    stripeKey: !!process.env.STRIPE_SECRET_KEY,
    stripeHook: !!process.env.STRIPE_WEBHOOK_SECRET,
    /* 本番の住所。決めていないと、支払い後の戻り先が配信ごとに変わる */
    siteUrl: !!(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL),
    /* 特商法の表記で、まだ空の項目 */
    sellerMissing: missingSeller(),
  };

  if (!supabase || !enrollmentId) {
    return NextResponse.json({
      mode: "local",
      host,
      env,
      auth,
      appVersion,
      sell,
      message: !supabase
        ? "Supabase 未設定です。視聴記録はブラウザ内（localStorage）に保存されます。"
        : "ログインしていないので、視聴記録はブラウザ内（localStorage）に保存されます。",
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
    if (!data) throw new Error("受講の行が見つかりません");
    return "あり";
  });

  /* apply-all.sql を流したか。版を返す関数があるかで見る */
  await check("schema", async () => {
    const { data, error } = await supabase.rpc("schema_version");
    if (error) {
      throw new Error(
        "版が読めません。supabase/apply-all.sql を SQL Editor で実行してください",
      );
    }
    const now = String(data ?? "");
    if (now < NEED_SCHEMA) {
      throw new Error(
        `いま ${now}。${NEED_SCHEMA} が要ります。supabase/apply-all.sql を SQL Editor でもう一度実行してください`,
      );
    }
    return `${now} まで入っている`;
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
  /* 版だけが古いときは、動いてはいる。壊れているかのように言わない */
  const onlyOldSchema =
    !ok && Object.entries(checks).every(([k, c]) => c.ok || k === "schema");

  return NextResponse.json({
    mode: ok ? "supabase" : onlyOldSchema ? "stale" : "error",
    host,
    env,
    auth,
    appVersion,
    sell,
    checks,
    message: ok
      ? "Supabase に接続できています。視聴記録・照合ログ・受験記録はサーバに保存されます。"
      : onlyOldSchema
        ? "動いていますが、データベースの版が古いままです。新しい supabase/apply-all.sql を SQL Editor で実行してください。"
        : "接続はできましたが、初期化が終わっていません。supabase/apply-all.sql を SQL Editor で実行してください。",
  });
}
