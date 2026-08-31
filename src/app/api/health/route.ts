import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServiceClient, getDevEnrollmentId } from "@/lib/supabase/server";
import { currentEnrollment } from "@/lib/enrollment";
import { currentUser } from "@/lib/supabase/session";
import { LATEST } from "@/content/changelog";
import { bankReady, invoiceOk, missingSeller, seller } from "@/content/legal";
import { isOwnerEmail, ownerEmails } from "@/lib/owner";
import { FALLBACK_SITE, sameSite, siteUrl as resetSiteUrl } from "@/lib/siteUrl";
import { allPrices, missingPrice } from "@/lib/price.server";
import { AUTH_MAIL_FROM, AUTH_MAIL_OWN } from "@/content/authMail";
import { siteUrl as paySiteUrl } from "@/lib/stripe";
import { currentAdmin } from "@/lib/admin";
import { myCompany } from "@/lib/tenant";
import { canLearn } from "@/lib/entitle";
import { readyCourses } from "@/content/courses";
import { NEED_SCHEMA } from "@/content/schema";
import { getLessonList } from "@/lib/curriculum";

/* 接続確認。/setup 画面がこれを見て、何が足りないかを表示する。
   鍵そのものは返さない（設定されているかどうかだけ）。 */


export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const devEnrollment = getDevEnrollmentId();
  const supabase = getServiceClient();
  const user = await currentUser();
  /* 記録の宛先を確かめるだけ。いちばん上の講座で見る */
  const who = await currentEnrollment(readyCourses()[0]?.id ?? "");
  const enrollmentId = who?.enrollmentId ?? devEnrollment;

  /* Vercel 上か手元か。手順の出し分けに使う（VERCEL は Vercel が自動で入れる） */
  const host: "vercel" | "local" = process.env.VERCEL ? "vercel" : "local";

  /* いま開いている入口。Vercel は本来の宛先を x-forwarded-host に入れる */
  const h = await headers();
  const hHost = h.get("x-forwarded-host") || h.get("host") || "";
  const hProto = h.get("x-forwarded-proto") || (hHost.startsWith("localhost") ? "http" : "https");
  const here = hHost ? `${hProto}://${hHost}` : "";

  const env = {
    url: url ? url.replace(/^https:\/\/([^.]{4})[^.]*/, "https://$1…") : null,
    anonKey: hasAnon,
    serviceKey: hasService,
    devEnrollmentId: !!devEnrollment,
    examSecret: !!process.env.EXAM_SECRET,
  };

  /* いま誰として記録しているか。鍵は返さない。
     メールは「いまログインしている本人のもの」なので返してよい
     （OWNER_EMAILS に入れる住所を確かめるため） */
  /* 受講できるか。「コード無しで開けてしまう」を調べるときに、
     何を根拠に通しているのかが分からないと直しようがない */
  const learn = await canLearn();
  /* 教育担当者か。ここが分からないと、
     「/admin が開かない」と言われたときに何も答えられない。
     所属も一緒に返す（担当者でないのか、そもそも所属が無いのか） */
  const admin = await currentAdmin();
  const co = admin ? { id: admin.companyId, name: admin.companyName } : await myCompany();
  const auth = {
    email: user?.email ?? null,
    /* 教育担当者として認められているか */
    admin: !!admin,
    /* いまの所属。空なら、どこの事業者にも紐付いていない */
    company: co?.name ?? "",
    /* 学科（特別教育）を開けるか、その根拠
       seat=受講コードを引き換えた／trial=無償利用の事業者／
       open=Supabase 未設定（手元で動かすとき） */
    canLearn: learn.ok,
    learnBy: learn.ok ? learn.by : `だめ（${learn.why}）`,
    /* 運営として認められているか。ここが「していない」なら、
       OWNER_EMAILS に入れた住所と、ログインしている住所が違う */
    owner: isOwnerEmail(user?.email),
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
    /* 1人あたりの単価。

       環境変数が入っているかどうかで見ていたので、入れていないと
       「未設定（仮の値）」と橙で出ていた。いまは pricing.ts に
       決めた値（足場4,500・職長7,000）が入っているので、
       環境変数が無くても正しい金額で売れる。
       それを警告として出すと、本当に困る警告まで見なくなる。

       見るべきは「公開しているのに0円の講座があるか」。 */
    unitPrice: !!process.env.SEAT_UNIT_PRICE,
    /* 講座ごとの、いま実際に請求する単価（税抜） */
    prices: allPrices().map((p) => ({ id: p.id, name: p.name, price: p.price })),
    /* 0円のまま公開している講座。ここが空でないときだけ困る */
    priceMissing: missingPrice(),
    /* カード払い。無くても請求書払いで売れる */
    stripeKey: !!process.env.STRIPE_SECRET_KEY,
    stripeHook: !!process.env.STRIPE_WEBHOOK_SECRET,
    /* 本番の住所。決めていないと、支払い後の戻り先が配信ごとに変わる */
    siteUrl: !!(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL),
    /* 実際に使われる住所を、そのまま返す。

       戻り先を決める所が2つあり、読む変数が違う。
         ・支払いの戻り先 … SITE_URL → NEXT_PUBLIC_SITE_URL → VERCEL_URL
         ・合言葉の決め直しの戻り先 … NEXT_PUBLIC_SITE_URL だけ
           （画面から送るので NEXT_PUBLIC_ でないと読めない）
       だから SITE_URL だけを入れると、上は正しく直り、
       下は決め打ちの住所（FALLBACK_SITE）のまま残る。
       「設定済み」と緑で出ているのに、決め直しのメールだけ古い住所へ飛ぶ。
       独自ドメインに移すときに必ず踏むので、両方そのまま出す。 */
    payBase: paySiteUrl(),
    resetBase: resetSiteUrl(),
    /* 決め直しの戻り先を、環境変数で決めているか。

       前は resetSiteUrl() === FALLBACK_SITE で見ていた。
       決め打ちが古い vercel.app だった頃はそれで区別できたが、
       決め打ちを本番の住所に直した今は、環境変数を正しく入れていても
       値が同じになるので「決め打ちのまま」と橙が出てしまう。
       **値ではなく、環境変数が入っているかどうか**を見る。 */
    resetEnv: !!(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim(),
    /* 決め打ちの値そのもの。食い違ったときに、どこを直すかの手がかり */
    resetDefault: FALLBACK_SITE,
    /* いま開いている入口。設定した住所と食い違っていないかを見るため。

       独自ドメインに移したとき、環境変数が古い住所のまま残っていると
       「設定済み」と緑で出るのに、メールのリンクだけ古い所へ飛ぶ。
       設定してあるかどうかではなく、**いま人が開いている入口と同じか**
       を見ないと気づけない。 */
    here,
    payHere: sameSite(paySiteUrl(), here),
    resetHere: sameSite(resetSiteUrl(), here),
    /* 認証メールの差出人。

       共用送信元のままだと、見た目が怪しいだけでなく
       1時間に数通までしか出ない（docs/21）。忘れないよう、ここに出す。
       送信元を変えたら src/content/authMail.ts を直すこと。
       直し忘れると、画面に嘘の差出人が出たままになる。 */
    mailFrom: AUTH_MAIL_FROM,
    mailOwn: AUTH_MAIL_OWN,
    /* 特商法の表記で、まだ空の項目 */
    sellerMissing: missingSeller(),
    /* 振込先。空だと請求書に「別途ご案内」としか出ず、そのぶん入金が遅れる */
    bank: bankReady(seller().bank),
    /* 適格請求書発行事業者の登録番号。
       課税事業者なら、請求書に載せないと相手が仕入税額控除を受けられない。
       免税事業者なら番号が無いので、空で正しい。だから「足りない」とは言わない */
    invoiceNo: !!seller().invoiceNo,
    /* T＋13桁の形。打ち間違いをそのまま請求書に載せないため */
    invoiceShape: invoiceOk(seller().invoiceNo),
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

  /* 単元の数は、教材から数える。13で決め打つと、
     講座を足した日に「足りない」と嘘をつく。

     講座ごとに数える。合計だけを見ていると、
     「26件のはずが13件」としか出ず、どの講座が入っていないのか分からない。
     公開に切り替えたあと apply-all.sql を流し忘れると必ずここに来るので、
     足りない講座の名前を出す。 */
  const wantEach = await Promise.all(
    readyCourses().map(async (c) => ({ id: c.id, short: c.short, n: (await getLessonList(c.id)).length })),
  );
  const want = wantEach.reduce((n, c) => n + c.n, 0);
  await check("lessons", async () => {
    const got = await Promise.all(
      wantEach.map(async (c) => {
        const { count, error } = await supabase
          .from("lessons")
          .select("lesson_id", { count: "exact", head: true })
          .eq("course_id", c.id);
        if (error) throw new Error(error.message);
        return { ...c, got: count ?? 0 };
      }),
    );
    const short = got.filter((c) => c.got !== c.n);
    if (short.length) {
      throw new Error(
        `${short.map((c) => `${c.short} が ${c.got}件（${c.n}件のはず）`).join("、")}。` +
          "npm run build:sql を流してから、supabase/apply-all.sql を SQL Editor で実行してください",
      );
    }
    return `${want}件（${got.map((c) => `${c.short} ${c.got}`).join("／")}）`;
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
    /* どの単元で試すかは、決め打ちにしない。
       0011 で単元IDに講座が付いて「ashiba:1-1」になったとき、
       ここだけ「1-1」のままになり、外部キーで弾かれていた。
       設定は正しいのに /setup が赤くなる、といういちばん困る出方をする。
       表から1件もらえば、講座が増えても番号が変わっても付いていける */
    const courseId = readyCourses()[0]?.id ?? "";
    const { data: lesson, error: e0 } = await supabase
      .from("lessons")
      .select("lesson_id")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    const lessonId = (lesson?.lesson_id as string | undefined) ?? "";
    if (!lessonId) {
      throw new Error(`${courseId} の単元が lessons にありません。npm run sync:lessons を実行してください`);
    }
    // 0秒の同期。加算されないので記録は汚れない
    const { error } = await supabase.rpc("sync_watched_sec", {
      p_enrollment_id: enrollmentId,
      p_lesson_id: lessonId,
      p_delta_sec: 0,
    });
    if (error) throw new Error(error.message);
    return `sync_watched_sec 応答あり（${lessonId}）`;
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
