"use client";

import { useCallback, useEffect, useState } from "react";
import { HANDOFF_MIN, showHandoff } from "@/lib/handoff";
import { Overlay } from "./Overlay";

/* ログインしたあとに出す、ホーム画面のアプリに入るコード（0036）。

   げんきさん（2026-09-09）
     「ホーム画面アプリへ入るコードを出すのがマイページだと
       誰も分からないし面倒くさい。ログイン後にポップアップ表示して。
       コードもコピーボタン設置」

   ── なぜ要るか ──
   LINEログインは、よそのサイトへ一度出る。iPhone のホーム画面アプリは
   出た時点でブラウザに切り替わり、そのまま戻ってこない。
   ログインの記憶も別なので、ブラウザで入ってもアプリは入っていない。

   **メールとパスワードで入る人には、これは起きない。**
   アプリの中で完結するので、一度入れば入りっぱなし（げんきさんの
   「LINE接続するまでは問題なかった」はそのとおり）。
   だから出すのは、**ブラウザで開いている人にだけ。**

   ── 出す条件 ──
   ・いまアプリとして開いていない（アプリの中なら、もう入っている）
   ・ログインした直後（ログインの画面が印を置く／LINE は ?app=1 で戻る）
   ・「今後出さない」を押していない

   ── 決めたこと ──
   ・**コードはすぐ出す。**「作る」を押させると、そこで止まる人が出る
   ・コピーの札を置く。8文字でも、打ち間違える
   ・5分で切れることを、その場に書く */

const SEEN = "app-code-off";
export const FLAG = "app-code-show";

/** いまホーム画面のアプリとして開いているか */
const standalone = (): boolean => {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    nav.standalone === true
  );
};

export function AppCode() {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ng, setNg] = useState("");

  const close = useCallback((forever: boolean) => {
    setOpen(false);
    try {
      sessionStorage.removeItem(FLAG);
      if (forever) localStorage.setItem(SEEN, "1");
    } catch { /* 端末が記憶を断っていても、閉じるのは効く */ }
  }, []);

  useEffect(() => {
    let alive = true;
    try {
      /* アプリの中なら要らない。もう入っている */
      if (standalone()) return;
      if (localStorage.getItem(SEEN) === "1") return;
      const url = new URL(window.location.href);
      const asked = url.searchParams.get("app") === "1";
      if (!asked && sessionStorage.getItem(FLAG) !== "1") return;
      /* 住所から印を消す。読み込み直しで何度も出さない */
      if (asked) {
        url.searchParams.delete("app");
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      return;
    }
    setOpen(true);
    void (async () => {
      try {
        const res = await fetch("/api/handoff", { method: "POST" });
        const j = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !j.ok) { setNg("コードを出せませんでした。"); return; }
        setCode(typeof j.code === "string" ? j.code : "");
      } catch {
        if (alive) setNg("コードを出せませんでした。");
      }
    })();
    return () => { alive = false; };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNg("コピーできませんでした。手で打ってください。");
    }
  };

  if (!open) return null;

  return (
    <Overlay>
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 print:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      data-testid="app-code"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-5">
        <div className="text-[11px] tracking-[2px] text-dim">ホーム画面のアプリ</div>
        <h2 className="mt-1 text-[17px] font-black">アプリからも入れるようにしますか</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
          ホーム画面に追加したアプリは、
          <span className="text-txt">このコードを打つと入れます。</span>
          LINEで入るとブラウザに切り替わってしまうので、こちらから渡します。
        </p>

        {ng && <div className="mt-3 text-[12px] text-ng-tx" data-testid="app-code-ng">{ng}</div>}

        {code && (
          <>
            <div
              className="mt-3 rounded-lg border border-yel bg-bg p-3 text-center font-mono text-[26px] font-black tracking-[4px] text-yel"
              data-testid="app-code-value"
            >
              {showHandoff(code)}
            </div>
            <button
              onClick={() => void copy()}
              className="mt-2 w-full rounded-lg border border-line p-2.5 text-[13px] font-bold text-txt"
              data-testid="app-code-copy"
            >
              {copied ? "コピーしました" : "コードをコピー"}
            </button>
            <div className="mt-2 text-[11.5px] leading-relaxed text-dim2">
              ホーム画面のアプリを開いて、ログインの画面の
              <span className="text-dim">「コードで入る」</span>に貼ってください。
              <br />
              {HANDOFF_MIN}分で使えなくなります。1回だけ使えます。
              あとからマイページでも作れます。
            </div>
          </>
        )}
        {!code && !ng && (
          <div className="mt-3 text-[12.5px] text-dim2">コードを出しています…</div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => close(false)}
            className="flex-1 rounded-lg border border-line p-2.5 text-[13px] font-bold text-txt"
            data-testid="app-code-close"
          >
            閉じる
          </button>
          <button
            onClick={() => close(true)}
            className="rounded-lg border border-line px-3 py-2.5 text-[12px] text-dim"
            data-testid="app-code-never"
          >
            今後出さない
          </button>
        </div>
      </div>
    </div>
    </Overlay>
  );
}
