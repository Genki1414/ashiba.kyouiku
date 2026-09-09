"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LATEST, unseen, type Release } from "@/content/changelog";
import { Btn } from "@/components/ui/Btn";

/* お知らせの本文で **ここ** と書いたところを太字にする。

   そのまま出していたので、画面に「**」が見えていた。
   使えるのは太字だけ。ほかの記法は入れない
   （お知らせは自分たちで書くもので、外から来る文ではない）。 */
function bold(t: string): React.ReactNode[] {
  return t.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-extrabold">{part}</strong> : part,
  );
}


/* 開いたときに、前に見たときから何が変わったかを知らせる。

   ── 一度確かめたら、もう自分からは出ない（げんきさん 2026-09-09）──
   前は**更新のたびに**画面いっぱいに出ていた。直しを何度も出す日は、
   開くたびに知らせが被さって、やることに手が届かない。

   閉じた時点で「この人は知らせの場所を知った」ことにする。
   そのあと新しい更新が出ても、画面をふさがない。
   読みたいときは /updates にいつでも並んでいる（ホームの下に入口がある）。 */

const KEY = "ashiba.seen-update";
/** 一度でも閉じたか。閉じたあとは、もう自分からは出ない */
const ACK = "ashiba.update-ack";

export function UpdateNotice() {
  const [list, setList] = useState<Release[] | null>(null);
  const path = usePathname();
  /* ログインの前には出さない。まだ使っていない人に更新の知らせは要らないし、
     ログインの邪魔になる */
  const quiet = path === "/login" || path.startsWith("/auth");

  useEffect(() => {
    let seen: string | null = null;
    let ack = false;
    try {
      seen = window.localStorage.getItem(KEY);
      ack = window.localStorage.getItem(ACK) === "1";
    } catch {
      /* 読めない端末では、いちばん新しい1件だけ出す */
    }
    /* **一度閉じた人には、もう出さない。**新しい更新は /updates に並ぶ */
    if (ack) return;
    const rest = unseen(seen);
    if (rest.length) setList(rest);
  }, []);

  const close = () => {
    setList(null);
    try {
      window.localStorage.setItem(KEY, LATEST);
      window.localStorage.setItem(ACK, "1");
    } catch {
      /* 覚えられなくても、この回は閉じる */
    }
  };

  if (!list || quiet) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0C1015ee] p-4 print:hidden"
      data-testid="update-notice"
    >
      <div className="mx-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-yel bg-panel">
        <div className="flex-none border-b border-line px-4 py-3">
          <div className="text-[11px] font-extrabold tracking-[2px] text-yel">更新のお知らせ</div>
          <div className="mt-1 text-[15px] font-black">
            {list.length > 1 ? `${list.length}件の更新があります` : list[0].title}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {list.map((r) => (
            <div key={r.v} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-dim">{r.d}</span>
                {list.length > 1 && <span className="text-[12.5px] font-bold">{r.title}</span>}
              </div>
              {r.items.map((c, i) => (
                <div key={i} className="mb-2 flex gap-2.5">
                  <span
                    className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                      c.k === "追加" ? "bg-grn text-bg" : "bg-cyan text-bg"
                    }`}
                  >
                    {c.k}
                  </span>
                  <span className="text-[12.5px] leading-relaxed">{bold(c.t)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-none border-t border-line p-3">
          <Btn tone="y" onClick={close} testid="update-close">
            閉じる
          </Btn>
        </div>
      </div>
    </div>
  );
}
