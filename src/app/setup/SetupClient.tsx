"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";

type Health = {
  mode: "local" | "supabase" | "stale" | "error";
  /** どこで動いているか。手順の出し分けに使う */
  host?: "vercel" | "local";
  message: string;
  env: {
    url: string | null;
    anonKey: boolean;
    serviceKey: boolean;
    devEnrollmentId: boolean;
    examSecret: boolean;
  };
  checks?: Record<string, { ok: boolean; detail: string }>;
  schema?: { now: string; need: string; ok: boolean };
  /* いま誰として記録しているか */
  auth?: { required: boolean; signedIn: boolean; enrollment: string; email?: string | null; owner?: boolean; admin?: boolean; company?: string; canLearn?: boolean; learnBy?: string };
  /* この版がいつのものか。新しい版が届いているかを見る目印 */
  appVersion?: string;
  /* 売るために要る設定。空のままだと売れない */
  sell?: {
    owners: number;
    unitPrice: boolean;
    prices: { id: string; name: string; price: number }[];
    priceMissing: string[];
    /** 環境変数が値段を上書きしている講座。
        **運営でログインしていないときは null**（商売の中身なので出さない） */
    priceOverrides: { id: string; name: string; env: string; now: number; code: number }[] | null;
    stripeKey: boolean;
    stripeHook: boolean;
    siteUrl: boolean;
    payBase: string;
    resetBase: string;
    mailFrom: string;
    mailOwn: boolean;
    notify: boolean;
    /** LINE でログインできるか */
    lineLogin?: boolean;
    lineMenu?: boolean;
    lineHook?: boolean;
    resetEnv: boolean;
    resetDefault: string;
    here: string;
    payHere: boolean;
    resetHere: boolean;
    sellerMissing: string[];
    invoiceNo?: boolean;
    invoiceShape?: boolean;
    bank?: boolean;
    /** この店の本番の住所（src/content/brand.ts）。決まっていない店は空 */
    brandSite?: string;
    brand?: string;
  };
};

/* NEXT_PUBLIC_ はビルド時にこのファイルへ直接埋め込まれる。
   サーバ側の値と突き合わせると、届いていないのがビルド時か実行時かが分かる。 */
const BROWSER_ENV: [string, boolean][] = [
  ["NEXT_PUBLIC_SUPABASE_URL", !!process.env.NEXT_PUBLIC_SUPABASE_URL],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ["NEXT_PUBLIC_AUDIO_BASE", !!process.env.NEXT_PUBLIC_AUDIO_BASE],
];

const CHECK_LABEL: Record<string, string> = {
  lessons: "lessons テーブル（単元13件）",
  schema: "apply-all.sql を流したか",
  enrollment: "受講の行",
  rpc: "視聴時間の関数（sync_watched_sec）",
};

/* 何を根拠に受講できているか。「コード無しで開けてしまう」を調べるとき、
   ここが分からないと直しようがない */
const LEARN_BY: Record<string, string> = {
  seat: "受講コードを引き換えている",
  trial: "無償利用の事業者",
  open: "Supabase 未設定なので素通し",
};

export function SetupClient() {
  const [h, setH] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setH(await res.json());
    } catch {
      setH(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Supabase の設定そのものは入っているか。
     mode が "local" になる理由は2つあって、意味がまるで違う。
       ・鍵が入っていない      → 本当に未設定
       ・入っているが未ログイン → 設定は済んでいて、いま見ている人の話
     前は両方まとめて「未設定（端末内記録）」と出していた。
     **設定は正しいのに、入っていないように読める。**
     SQL を流したあと版を確かめに来て、ここで詰まった */
  const configured = !!h?.env?.url && h.env.anonKey;
  const justSignedOut = h?.mode === "local" && configured;

  const tone =
    h?.mode === "supabase"
      ? "border-grn text-grn"
      : h?.mode === "error"
        ? "border-red text-red"
        : "border-org text-org";

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pt-6">
        <Link href="/" className="backlink text-[13px] text-dim no-underline">
          ← ホーム
        </Link>
        <h1 className="mt-2 text-[20px] font-black">接続の確認</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-dim">
          Supabase につながっているか、初期化が済んでいるかを確かめます。
        </p>
      </div>

      <div className="px-5 pt-4">
        {loading && <div className="text-[13px] text-dim">確認中…</div>}

        {h && (
          <>
            <div className={`rounded-xl border bg-panel p-4 ${tone}`}>
              <div className="text-[11px] font-extrabold tracking-widest">
                {h.mode === "supabase"
                  ? "接続できています"
                  : h.mode === "stale"
                    ? "動いています（版が古い）"
                    : h.mode === "error"
                      ? "初期化が未完了"
                      : justSignedOut
                        ? "ログインしていません（設定は入っています）"
                        : "未設定（端末内記録）"}
              </div>
              <div className="mt-1.5 text-[13px] leading-relaxed text-txt">{h.message}</div>
            </div>

            {/* データベースの版。**SQL を流すたびに見る所**なので、
                いちばん上に置く。前は checks の中に紛れていて、
                ページのいちばん下まで探しにいく必要があった。
                いま入っている版と、要る版の**両方**を出す。
                片方だけでは、流し終わったのかが分からない */}
            {h.schema && (
              <div
                className={`mt-3 flex items-baseline gap-2 rounded-xl border bg-panel p-4 ${
                  h.schema.ok ? "border-line" : "border-org"
                }`}
                data-testid="schema-row"
              >
                <span className={`text-[13px] ${h.schema.ok ? "text-grn" : "text-org"}`}>
                  {h.schema.ok ? "✓" : "！"}
                </span>
                <span className="text-[12.5px] text-dim">データベースの版</span>
                <span className="ml-auto shrink-0 font-mono text-[13px] font-bold text-txt">
                  {h.schema.now || "読めません"}
                </span>
                <span className="shrink-0 text-[11.5px] text-dim2">／ 要る版 {h.schema.need}</span>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-line bg-panel p-4">
              <div className="mb-2 text-[11px] tracking-[2px] text-dim">サーバ側（実行時に読まれる）</div>
              {(
                [
                  ["NEXT_PUBLIC_SUPABASE_URL", h.env.url ?? "未設定"],
                  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", h.env.anonKey ? "設定済み" : "未設定"],
                  ["SUPABASE_SERVICE_ROLE_KEY", h.env.serviceKey ? "設定済み" : "未設定"],
                  ["DEV_ENROLLMENT_ID", h.env.devEnrollmentId ? "設定済み" : "未設定"],
                  ["EXAM_SECRET", h.env.examSecret ? "設定済み" : "未設定（開発用の既定値を使用）"],
                ] as const
              ).map(([k, v]) => {
                const ng = v === "未設定";
                return (
                  <div key={k} className="mb-1.5 flex items-baseline gap-2">
                    <span className={`text-[13px] ${ng ? "text-dim2" : "text-grn"}`}>{ng ? "□" : "✓"}</span>
                    <span className="font-mono text-[11px] text-dim">{k}</span>
                    <span className={`ml-auto shrink-0 text-[12px] ${ng ? "text-dim2" : "text-txt"}`}>{v}</span>
                  </div>
                );
              })}
            </div>

            {/* ブラウザ側（ビルド時に埋め込まれる） */}
            <div className="mt-3 rounded-xl border border-line bg-panel p-4">
              <div className="mb-1 text-[11px] tracking-[2px] text-dim">
                ブラウザ側（ビルド時に埋め込まれる）
              </div>
              <div className="mb-2 text-[11px] leading-relaxed text-dim2">
                サーバ側は「設定済み」なのにここが「届いていない」なら、ビルドに値が渡っていません。
                Sensitive を外すか、ビルドキャッシュを使わずに Redeploy してください。
              </div>
              {BROWSER_ENV.map(([k, ok]) => (
                <div key={k} className="mb-1.5 flex items-baseline gap-2">
                  <span className={`text-[13px] ${ok ? "text-grn" : "text-dim2"}`}>{ok ? "✓" : "□"}</span>
                  <span className="font-mono text-[11px] text-dim">{k}</span>
                  <span className={`ml-auto shrink-0 text-[12px] ${ok ? "text-txt" : "text-dim2"}`}>
                    {ok ? "届いている" : "届いていない"}
                  </span>
                </div>
              ))}
            </div>

            {/* ログインの状態。ここが「求めない」なら、新しい版がまだ届いていない */}
            {h.auth && (
              <div className="mt-3 rounded-xl border border-line bg-panel p-4" data-testid="setup-auth">
                <div className="mb-1 text-[11px] tracking-[2px] text-dim">ログイン</div>
                <div className="mb-2 text-[11px] leading-relaxed text-dim2">
                  Supabase を設定してあれば、ログインしないと中を開けません。
                  ここが「求めない」なら、新しい版がまだ届いていません。
                </div>
                {(
                  [
                    ["ログインを求める", h.auth.required ? "求める" : "求めない", h.auth.required],
                    ["いまログインしているか", h.auth.signedIn ? "している" : "していない", h.auth.signedIn],
                    ["記録の宛先", h.auth.enrollment, h.auth.enrollment === "本人"],
                    ["いまのメール", h.auth.email ?? "（ログインなし）", !!h.auth.email],
                    /* 「コード無しで開けてしまう」を調べるとき、
                       何を根拠に通しているのかが分からないと直せない */
                    [
                      "学科・実務を開けるか",
                      h.auth.canLearn
                        ? `開ける（${LEARN_BY[h.auth.learnBy ?? ""] ?? h.auth.learnBy ?? ""}）`
                        : "開けない（受講コードが要る）",
                      true,
                    ],
                    /* 「/admin が開かない」と言われたとき、
                       担当者でないのか、そもそも所属が無いのかで直し方が違う */
                    ["いまの所属", h.auth.company || "（どこにも属していない）", !!h.auth.company],
                    [
                      "教育担当者として認める",
                      h.auth.admin
                        ? "認める"
                        : h.auth.company
                          ? "認めない（この会社の受講者）"
                          : "認めない（所属が無い）",
                      !!h.auth.admin,
                    ],
                    [
                      "運営として認める",
                      h.auth.owner ? "認める" : "認めない（OWNER_EMAILS と違う住所）",
                      !!h.auth.owner,
                    ],
                  ] as const
                ).map(([k, v, ok]) => (
                  <div key={k} className="mb-1.5 flex items-baseline gap-2">
                    <span className={`text-[13px] ${ok ? "text-grn" : "text-org"}`}>{ok ? "✓" : "！"}</span>
                    <span className="text-[12.5px] text-dim">{k}</span>
                    <span className={`ml-auto shrink-0 text-[12.5px] ${ok ? "text-txt" : "text-org"}`}>{v}</span>
                  </div>
                ))}
                {h.appVersion && (
                  <div className="mt-2 border-t border-line pt-2 text-[11.5px] text-dim">
                    いま動いている版　
                    <span className="font-mono text-txt">{h.appVersion}</span>
                  </div>
                )}
              </div>
            )}

            {h.sell && (
              <div className="mt-3 rounded-xl border border-line bg-panel p-4">
                <div className="mb-2 text-[11px] tracking-[2px] text-dim">売るための設定</div>
                {(
                  [
                    ["修了試験の署名鍵（EXAM_SECRET）", h.env?.examSecret ? "設定済み" : "未設定（本番では試験が止まります）", !!h.env?.examSecret, true],
                    ["本部のメール（OWNER_EMAILS）", h.sell.owners ? `${h.sell.owners}人` : "未設定", h.sell.owners > 0, true],
                    /* 環境変数の有無ではなく、実際に請求する金額を出す。
                       決めた値が pricing.ts に入っているので、
                       環境変数が無くても正しい金額で売れる */
                    [
                      "単価（税抜）",
                      h.sell.priceMissing.length
                        ? `${h.sell.priceMissing.join("・")}が0円のまま`
                        : (h.sell.prices ?? [])
                            .map((p) => `${p.name} ${p.price.toLocaleString()}円`)
                            .join("／") || "公開中の講座がありません",
                      h.sell.priceMissing.length === 0 && (h.sell.prices ?? []).length > 0,
                      true,
                    ],
                    /* **環境変数がコードの値段に勝っている講座。**
                       ここを出していなかったので、コードでフルハーネスを
                       4,500円に下げたのに、本番は6,000円のままだった。
                       半年ぶんの取りこぼしに、画面のどこを見ても気づけなかった。

                       店が二つになった今は、片方に環境変数が残っていると
                       同じ講座が店によって違う値段になる。 */
                    [
                      "値段を環境変数で上書きしていないか",
                      /* null は「運営でログインしていないので出していない」。
                         空配列（上書きなし）と区別する。区別しないと、
                         ログインせずに開いた人に「上書きなし」と出て、
                         **本当は上書きされているのに安心してしまう** */
                      h.sell.priceOverrides === null
                        ? "運営でログインすると出ます（商売の中身なので、誰にでもは出しません）"
                        : h.sell.priceOverrides.length
                          ? h.sell.priceOverrides
                              .map((o) => `${o.name}：いま ${o.now.toLocaleString()}円（${o.env} を消すと ${o.code.toLocaleString()}円）`)
                              .join("／")
                          : "上書きなし（値段はコードだけで決まっています）",
                      h.sell.priceOverrides === null ? true : h.sell.priceOverrides.length === 0,
                      true,
                    ],
                    ["本番のURL（SITE_URL / NEXT_PUBLIC_SITE_URL）", h.sell.siteUrl ? "設定済み" : "未設定（配信ごとの住所を使う）", h.sell.siteUrl, true],
                    /* **店ごとの住所。**決まっていない店で環境変数も入れないと、
                       パスワード再設定のメールと LINE の知らせが、配信ごとに
                       変わる住所へ戻る（Supabase の許した住所に無いと弾かれる）。
                       前はここでよその店の住所へ飛んでいた（2026-09-08 に直した）。
                       よそへ飛ばすよりは弾かれる方がよいが、直すまでは橙で出す */
                    [
                      "この店の住所（src/content/brand.ts の site）",
                      h.sell.brandSite
                        ? h.sell.brandSite
                        : h.sell.siteUrl
                          ? "コードには入れていない（NEXT_PUBLIC_SITE_URL が勝つので、いまは大丈夫）"
                          /* ここは太字にできない（記号がそのまま出る）ので書かない */
                          : "決まっていません。NEXT_PUBLIC_SITE_URL を入れるまで、パスワード再設定のメールが配信ごとの住所へ飛びます",
                      !!(h.sell.brandSite || h.sell.siteUrl),
                      true,
                    ],
                    /* 住所そのものを出す。「設定済み」だけだと、
                       どちらの変数を入れたかで戻り先が食い違っていても気づけない。

                       さらに、いま開いている入口と同じかまで見る。
                       独自ドメインに移したとき、環境変数が古い住所のまま
                       残っていても「設定済み」で緑になってしまい、
                       メールのリンクだけ古い所へ飛ぶ。 */
                    [
                      "支払い後の戻り先",
                      h.sell.payHere
                        ? h.sell.payBase
                        : `${h.sell.payBase}（いま開いているのは ${h.sell.here}。SITE_URL を直して再デプロイ）`,
                      h.sell.payHere,
                      true,
                    ],
                    [
                      "パスワード再設定の戻り先",
                      h.sell.resetHere
                        ? /* 合っている。環境変数で決めていなければ、そこだけ添える */
                          h.sell.resetEnv
                          ? h.sell.resetBase
                          : `${h.sell.resetBase}（NEXT_PUBLIC_SITE_URL は空。コードの決め打ちで動いています）`
                        : `${h.sell.resetBase}（いま開いているのは ${h.sell.here}。NEXT_PUBLIC_SITE_URL を直して再デプロイ）`,
                      h.sell.resetHere,
                      true,
                    ],
                    ["特商法の表記", h.sell.sellerMissing.length ? `${h.sell.sellerMissing.join("・")}が空` : "そろっている", h.sell.sellerMissing.length === 0, true],
                    /* 番号はコードに固定してある（src/content/legal.ts）。
                       前は環境変数だけに置いていて、店を増やしたとき
                       新しい店の特商法が「未設定」で出た（2026-09-07）。
                       設定は要らない。番号が変わったときだけ入れる */
                    ["インボイス登録番号（SELLER_INVOICE_NO）",
                      h.sell.invoiceShape === false
                        ? "形が違います（T＋13桁）"
                        : h.sell.invoiceNo
                          ? "出ています（コードに固定。環境変数は要りません）"
                          : "未設定（免税事業者なら空のままで構いません）",
                      h.sell.invoiceShape !== false, false],
                    ["振込先（SELLER_BANK_NAME ほか）",
                      h.sell.bank ? "設定済み" : "未設定（請求書に「別途ご案内」と出ます）",
                      h.sell.bank === true, true],
                    /* 共用送信元のままだと、見た目が怪しいだけでなく
                       1時間に数通までしか出ない（docs/21）。
                       「！」にはしない。数人なら上限に当たらず、
                       本当に売れなくなるわけではないため */
                    [
                      "認証メールの差出人",
                      h.sell.mailOwn
                        ? h.sell.mailFrom
                        : `${h.sell.mailFrom}（共用の送信元。1時間に数通まで）`,
                      h.sell.mailOwn,
                      false,
                    ],
                    /* 申込が来たときの知らせ。無くても売れるので「！」にはしない。
                       ただ、入れていないと許可の出し忘れに気づけない */
                    [
                      "申込の知らせ（LINE_TOKEN / LINE_TO）",
                      h.sell.notify ? "設定済み" : "未設定（申込が来ても知らせません）",
                      h.sell.notify,
                      false,
                    ],
                    /* LINE でログインできるか（0033）。無くてもメールで入れるので
                       「！」にはしない。現場の方はメールを使わないことが多い */
                    [
                      "LINEログイン（LINE_LOGIN_CHANNEL_ID / SECRET）",
                      h.sell.lineLogin ? "設定済み" : "未設定（メールとパスワードのみ）",
                      !!h.sell.lineLogin,
                      false,
                    ],
                    /* リッチメニューを配る鍵。入っていないと、運営管理で押しても
                       断られる。押す前にここで分かるようにする */
                    [
                      "リッチメニュー（LINE_MENU_TOKEN）",
                      h.sell.lineMenu ? "設定済み（運営管理のLINEから配れます。知らせもこの鍵で送ります）" : "未設定（メニューを配れません）",
                      !!h.sell.lineMenu,
                      false,
                    ],
                    /* LINE から受け取る鍵。運営が「設定」と送ると
                       設定の様子が返る（docs/106） */
                    [
                      "LINEから受ける（LINE_BOT_SECRET）",
                      h.sell.lineHook ? "設定済み（LINEに「設定」と送ると返します）" : "未設定（LINEから聞けません）",
                      !!h.sell.lineHook,
                      false,
                    ],
                    ["カード払い（STRIPE_SECRET_KEY）", h.sell.stripeKey ? "設定済み" : "未設定（請求書払いのみ）", h.sell.stripeKey, false],
                    ["カードの入金確認（STRIPE_WEBHOOK_SECRET）", h.sell.stripeHook ? "設定済み" : "未設定", h.sell.stripeHook, false],
                  ] as [string, string, boolean, boolean][]
                ).map(([k, v, ok, need]) => (
                  /* 見出しと値を足して長いときは、値を下の行に落とす。
                     横に並べたままだと、値が幅を取り切って見出しが
                     1文字ずつ縦に折れる（「単価」「合言葉の決め直しの戻り先」
                     「インボイス登録番号」で実際にそうなっていた）。

                     値の長さだけで決めると、見出しが長い行を取りこぼす。
                     狭い画面に収まるかは**両方の長さの合計**で決まる。 */
                  <div key={k} className="mb-1.5 flex items-baseline gap-2">
                    <span className={`shrink-0 text-[13px] ${ok ? "text-grn" : need ? "text-org" : "text-dim2"}`}>
                      {ok ? "✓" : need ? "！" : "−"}
                    </span>
                    {k.length + v.length > 30 ? (
                      <span className="min-w-0 flex-1 text-[12.5px] text-dim">
                        {k}
                        <br />
                        <span className={`break-all ${ok ? "text-txt" : need ? "text-org" : "text-dim2"}`}>
                          {v}
                        </span>
                      </span>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 text-[12.5px] text-dim">{k}</span>
                        <span className={`shrink-0 text-[12.5px] ${ok ? "text-txt" : need ? "text-org" : "text-dim2"}`}>
                          {v}
                        </span>
                      </>
                    )}
                  </div>
                ))}
                <div className="mt-2 border-t border-line pt-2 text-[11.5px] leading-relaxed text-dim2">
                  「！」が残っていると、まだ売れません。カード払いの2つは、
                  無くても請求書払いで売れます。詳しくは docs/11・docs/12。
                </div>
              </div>
            )}

            {h.checks && (
              <div className="mt-3 rounded-xl border border-line bg-panel p-4">
                <div className="mb-2 text-[11px] tracking-[2px] text-dim">データベース</div>
                {Object.entries(h.checks).map(([k, c]) => (
                  <div key={k} className="mb-2">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-[13px] ${c.ok ? "text-grn" : "text-red"}`}>{c.ok ? "✓" : "✕"}</span>
                      <span className="text-[13px] font-bold">{CHECK_LABEL[k] ?? k}</span>
                    </div>
                    <div className={`ml-5 text-[12px] leading-relaxed ${c.ok ? "text-dim" : "text-ng-tx"}`}>
                      {c.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {h.mode !== "supabase" && (
              <div className="mt-3 rounded-xl border border-line bg-panel p-4 text-[12.5px] leading-loose text-dim">
                <div className="mb-1.5 text-[11px] tracking-[2px] text-yel">
                  手順（{h.host === "vercel" ? "Vercel" : "手元の開発"}）
                </div>
                {h.host === "vercel" ? (
                  <>
                    1. Supabase の SQL Editor で{" "}
                    <span className="font-mono text-txt">supabase/apply-all.sql</span> を貼って実行
                    <br />
                    2. Project Settings → API Keys で URL と2つの鍵を取得
                    <br />
                    3. Vercel の Settings → Environment Variables に5つ追加（Production にチェック）
                    <br />
                    4. Deployments → 最新 → ⋯ → <span className="text-txt">Redeploy</span>
                    <br />
                    <span className="text-org">
                      環境変数はビルド時に読まれます。追加しただけでは変わりません。
                    </span>
                  </>
                ) : (
                  <>
                    1. Supabase の SQL Editor で{" "}
                    <span className="font-mono text-txt">supabase/apply-all.sql</span> を貼って実行
                    <br />
                    2. Project Settings → API Keys で URL と2つの鍵を取得
                    <br />
                    3. <span className="font-mono text-txt">.env.local</span> に貼る（
                    <span className="font-mono text-txt">.env.example</span> が雛形）
                    <br />
                    4. 開発サーバを再起動して、この画面を再確認
                  </>
                )}
                <br />
                詳しくは <span className="font-mono text-txt">docs/01-Supabase接続手順.md</span>
              </div>
            )}

            <Btn onClick={load} className="mt-4">
              もう一度確認する
            </Btn>
          </>
        )}
      </div>
    </main>
  );
}
