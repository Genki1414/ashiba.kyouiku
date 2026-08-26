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
  /* いま誰として記録しているか */
  auth?: { required: boolean; signedIn: boolean; enrollment: string; email?: string | null; owner?: boolean; canLearn?: boolean; learnBy?: string };
  /* この版がいつのものか。新しい版が届いているかを見る目印 */
  appVersion?: string;
  /* 売るために要る設定。空のままだと売れない */
  sell?: {
    owners: number;
    unitPrice: boolean;
    stripeKey: boolean;
    stripeHook: boolean;
    siteUrl: boolean;
    sellerMissing: string[];
    invoiceNo?: boolean;
    invoiceShape?: boolean;
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
                      : "未設定（端末内記録）"}
              </div>
              <div className="mt-1.5 text-[13px] leading-relaxed text-txt">{h.message}</div>
            </div>

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
                    ["修了試験の合言葉（EXAM_SECRET）", h.env?.examSecret ? "設定済み" : "未設定（本番では試験が止まります）", !!h.env?.examSecret, true],
                    ["本部のメール（OWNER_EMAILS）", h.sell.owners ? `${h.sell.owners}人` : "未設定", h.sell.owners > 0, true],
                    ["単価（SEAT_UNIT_PRICE）", h.sell.unitPrice ? "設定済み" : "未設定（仮の値）", h.sell.unitPrice, true],
                    ["本番のURL（SITE_URL / NEXT_PUBLIC_SITE_URL）", h.sell.siteUrl ? "設定済み" : "未設定（配信ごとの住所を使う）", h.sell.siteUrl, true],
                    ["特商法の表記", h.sell.sellerMissing.length ? `${h.sell.sellerMissing.join("・")}が空` : "そろっている", h.sell.sellerMissing.length === 0, true],
                    ["インボイス登録番号（SELLER_INVOICE_NO）",
                      h.sell.invoiceShape === false
                        ? "形が違います（T＋13桁）"
                        : h.sell.invoiceNo
                          ? "設定済み"
                          : "未設定（免税事業者なら空のままで構いません）",
                      h.sell.invoiceShape !== false, false],
                    ["カード払い（STRIPE_SECRET_KEY）", h.sell.stripeKey ? "設定済み" : "未設定（請求書払いのみ）", h.sell.stripeKey, false],
                    ["カードの入金確認（STRIPE_WEBHOOK_SECRET）", h.sell.stripeHook ? "設定済み" : "未設定", h.sell.stripeHook, false],
                  ] as [string, string, boolean, boolean][]
                ).map(([k, v, ok, need]) => (
                  <div key={k} className="mb-1.5 flex items-baseline gap-2">
                    <span className={`text-[13px] ${ok ? "text-grn" : need ? "text-org" : "text-dim2"}`}>
                      {ok ? "✓" : need ? "！" : "−"}
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-dim">{k}</span>
                    <span className={`shrink-0 text-[12.5px] ${ok ? "text-txt" : need ? "text-org" : "text-dim2"}`}>
                      {v}
                    </span>
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
