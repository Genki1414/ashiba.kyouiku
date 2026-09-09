"use client";

import { useState } from "react";

/* LINE の設定。運営だけ。

   いまここで押せるのは1つ。**リッチメニューを配る**。
   LINE のトーク画面の下に、大きな札が3つ出るようになる
   （受講する／受講コード／マイページ）。

   絵は手元で作って public/richmenu.png に置いてある。
   ここは、それを LINE に送って「友だち全員の既定」にするだけ
   （げんきさん 2026-09-09。パソコンでコマンドを流さずに済むように）。 */

export function LineClient({ onNote }: { onNote: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const send = async () => {
    setBusy(true);
    setDone("");
    onNote("");
    try {
      const res = await fetch("/api/owner/line-menu", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { onNote(j.reason ?? "配れませんでした。"); return; }
      setDone("リッチメニューを配りました。LINEのトーク画面を開き直すと、下に3つの札が出ます。");
    } catch {
      onNote("接続できません。");
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

        {/* 出来上がりを先に見せる。押す前に中身が分かる */}
        <img
          src="/richmenu.png"
          alt="リッチメニューの見本"
          className="mt-3 w-full rounded-lg border border-line"
          data-testid="owner-line-preview"
        />

        <button
          onClick={() => void send()}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-grn bg-grn p-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
          data-testid="owner-line-menu"
        >
          {busy ? "配っています…" : "このメニューを配る"}
        </button>

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
    </div>
  );
}
