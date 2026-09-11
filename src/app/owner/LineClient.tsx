"use client";

import { useEffect, useState } from "react";

import { BRAND } from "@/content/brand";
import { AskDone, type Ask, type RunResult } from "@/components/AskDone";

/* LINE の設定。運営だけ。

   いまここで押せるのは1つ。**リッチメニューを配る**。
   LINE のトーク画面の下に、大きな札が3つ出るようになる
   （受講する／受講コード／マイページ）。

   絵は手元で作って public/richmenu.png に置いてある。
   ここは、それを LINE に送って「友だち全員の既定」にするだけ
   （げんきさん 2026-09-09。パソコンでコマンドを流さずに済むように）。

   **公式アカウントは店ごとに別。**足場屋革命-教育と特別教育ドットコムは
   別のアカウント（げんきさん 2026-09-09）。押した先を間違えると、よその店の
   友だちに配ってしまうので、**どの店の画面かを先に出す。** */

type St = {
  linked: boolean;
  lineUserId: string;
  menuReady: boolean;
  hookReady: boolean;
};

export function LineClient({ onNote }: { onNote: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [st, setSt] = useState<St | null>(null);
  /* 確かめる→やる→終わった（2026-09-10）。配ると全員のトークが変わる */
  const [ask, setAsk] = useState<Ask | null>(null);
  const [shown, setShown] = useState(false);

  /* いまの様子。押す前に、結び付いているかが分かるように */
  useEffect(() => {
    fetch("/api/owner/line-menu")
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        setSt({
          linked: !!j.linked,
          lineUserId: typeof j.lineUserId === "string" ? j.lineUserId : "",
          menuReady: !!j.menuReady,
          hookReady: !!j.hookReady,
        });
      })
      .catch(() => {});
  }, []);

  const send = async (): Promise<RunResult> => {
    setBusy(true);
    setDone("");
    onNote("");
    try {
      const res = await fetch("/api/owner/line-menu", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { onNote(j.reason ?? "配れませんでした。"); return false; }
      const msg = "LINEのトーク画面を開き直すと、下に3つの札が出ます。";
      setDone(`リッチメニューを配りました。${msg}`);
      return { done: "リッチメニューを配りました", doneBody: msg };
    } catch {
      onNote("接続できません。");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4" data-testid="owner-line">
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-1 text-[11px] tracking-[2px] text-dim">リッチメニュー</div>
        <p className="text-[12.5px] leading-relaxed text-dim">
          LINEのトーク画面の下に、大きな札を3つ出します。
          <span className="text-txt">受講する／受講コード／マイページ</span>の3つで、
          押すとこの仕組みが開きます。現場の方が「どこから入るか」で迷わなくなります。
        </p>

        {/* 店ごとに公式アカウントが違う。どこへ配るのかを先に出す */}
        <div
          className="mt-3 rounded-lg border border-line bg-bg p-2.5 text-[12px] leading-relaxed text-dim"
          data-testid="owner-line-brand"
        >
          配る先は<span className="text-txt">{BRAND.shortName}</span>のLINE公式アカウントです。
          もう一方の店には配られません。両方に出すときは、それぞれの運営管理で押してください。
        </div>

        {/* 出来上がりを先に見せる。押す前に中身が分かる */}
        <img
          src="/richmenu.png"
          alt="リッチメニューの見本"
          className="mt-3 w-full rounded-lg border border-line"
          data-testid="owner-line-preview"
        />

        <button
          onClick={() =>
            setAsk({
              title: "このメニューを配りますか",
              body: `${BRAND.name} の公式アカウントを友だち追加している全員のトーク画面に、下の3つの札が出ます。前のメニューは置き換わります。`,
              yes: "配る",
              done: "リッチメニューを配りました",
              run: send,
            })}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-grn bg-grn p-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
          data-testid="owner-line-menu"
        >
          {busy ? "配っています…" : "このメニューを配る"}
        </button>

        {/* ── LINE と結び付いているか（0034）──
            「設定」と送っても返らないとき、理由がここで分かる。
            番号は知らせの宛先（LINE_TO）に入れる値でもある */}
        {st && (
          <div className="mt-3 rounded-lg border border-line bg-bg p-2.5" data-testid="owner-line-link">
            <div className="text-[12px] leading-relaxed text-dim">
              このトークで「設定」と送ると、設定の様子が返ります。
            </div>
            {st.linked ? (
              <>
                <div className="mt-1.5 text-[12px] font-bold text-grn">
                  この店のLINEと結び付いています
                </div>
                <button
                  onClick={() => setShown((v) => !v)}
                  className="mt-1.5 text-[11.5px] text-cyan underline"
                  data-testid="owner-line-id-toggle"
                >
                  {shown ? "番号を隠す" : "自分のLINE番号を表示"}
                </button>
                {shown && (
                  <div
                    className="mt-1 break-all rounded border border-line bg-panel2 p-2 font-mono text-[11.5px] text-txt"
                    data-testid="owner-line-id"
                  >
                    {st.lineUserId}
                  </div>
                )}
                {shown && (
                  <div className="mt-1 text-[11px] leading-relaxed text-dim2">
                    知らせの宛先を店ごとに分けるときは、この番号を
                    <span className="font-mono text-dim">LINE_TO</span>
                    に入れてください。
                    <span className="text-dim">番号は店ごとに違います。</span>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1.5 text-[12px] leading-relaxed text-org" data-testid="owner-line-unlinked">
                この店のLINEと、まだ結び付いていません。
                <br />
                一度ログアウトして、ログイン画面の「LINEでログイン」で入り直すと結び付きます。
                結び付くまでは、「設定」と送っても返りません。
              </div>
            )}
            {!st.hookReady && (
              <div className="mt-2 text-[11.5px] leading-relaxed text-org">
                <span className="font-mono">LINE_BOT_SECRET</span>
                が未設定です。Vercel に入れて Redeploy してください。
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="mt-2 text-[12px] leading-relaxed text-grn" data-testid="owner-line-done">{done}</div>
        )}

        <div className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-dim2">
          先に、LINE公式アカウントの Messaging API で
          <span className="text-dim">チャネルアクセストークン（長期）</span>
          を発行し、Vercel の環境変数 <span className="font-mono text-dim">LINE_MENU_TOKEN</span>
          に入れて Redeploy してください。
          <br />
          札の名前や行き先を変えるときは、絵を作り直します（scripts/line-richmenu.ts）。
        </div>
      </div>
      <AskDone ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
