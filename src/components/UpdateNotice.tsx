"use client";

import { useEffect, useState } from "react";
import { LATEST, unseen, type Release } from "@/content/changelog";
import { Btn } from "@/components/ui/Btn";

/* 開いたときに、前に見たときから何が変わったかを知らせる。
   一度閉じれば、次の更新まで出ない。 */

const KEY = "ashiba.seen-update";

export function UpdateNotice() {
  const [list, setList] = useState<Release[] | null>(null);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = window.localStorage.getItem(KEY);
    } catch {
      /* 読めない端末では、いちばん新しい1件だけ出す */
    }
    const rest = unseen(seen);
    if (rest.length) setList(rest);
  }, []);

  const close = () => {
    setList(null);
    try {
      window.localStorage.setItem(KEY, LATEST);
    } catch {
      /* 覚えられなくても、この回は閉じる */
    }
  };

  if (!list) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0C1015ee] p-4"
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
                    className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                      c.k === "足した" ? "bg-grn text-bg" : "bg-cyan text-bg"
                    }`}
                  >
                    {c.k}
                  </span>
                  <span className="text-[12.5px] leading-relaxed">{c.t}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-none border-t border-line p-3">
          <Btn tone="y" onClick={close} testid="update-close">
            分かった
          </Btn>
        </div>
      </div>
    </div>
  );
}
