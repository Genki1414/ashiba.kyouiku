"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";

type Health = {
  mode: "local" | "supabase" | "error";
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
  enrollment: "開発用の受講（DEV_ENROLLMENT_ID）",
  rpc: "視聴時間の関数（sync_watched_sec）",
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
    h?.mode === "supabase" ? "border-grn text-grn" : h?.mode === "error" ? "border-red text-red" : "border-org text-org";

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pt-6">
        <Link href="/" className="text-[13px] text-dim no-underline">
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
                {h.mode === "supabase" ? "接続できています" : h.mode === "error" ? "初期化が未完了" : "未設定（端末内記録）"}
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
