"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CATEGORY_NAME, ITEMS, type Category, type Item } from "@/training/catalog/items";
import { ItemArt } from "@/components/training/ItemArt";

/* 資材カタログ（16点）。画面内に収める作り（HANDOFF.md 2章）。
   一覧をタップすると1点ぶんの説明が開く。 */

const ORDER: Category[] = ["base", "post", "rail", "floor", "brace", "cover"];

export function CatalogClient() {
  const sp = useSearchParams();
  /* 章の中から開いたときは、戻り先を渡してもらう */
  const back = sp.get("back") ?? "/training";
  const [open, setOpen] = useState<Item | null>(null);

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pb-3 pt-5">
        <Link href={back} className="backlink text-[13px] text-dim no-underline">
          ← 戻る
        </Link>
        <h1 className="mt-2 text-[18px] font-black">資材カタログ</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-dim">
          第1章で使う資材。名前と、どこに何のために付くか。
        </p>
      </div>

      {ORDER.map((cat) => {
        const list = ITEMS.filter((i) => i.cat === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="mb-4 px-5">
            <div className="mb-2 text-[11px] font-extrabold tracking-[2px] text-yel">
              {CATEGORY_NAME[cat]}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {list.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setOpen(it)}
                  className="rounded-xl border border-line bg-panel p-3 text-left"
                >
                  <div className="mb-2 overflow-hidden rounded-lg bg-[#10151B]">
                    <ItemArt id={it.id} />
                  </div>
                  <div className="text-[13.5px] font-extrabold leading-snug">{it.nm}</div>
                  <div className="mt-0.5 text-[10.5px] leading-snug text-dim2">{it.yomi}</div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {open && (
        <div
          className="fixed inset-0 z-30 flex flex-col bg-[#0C1015]"
          onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        >
          <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
            <span className="text-[12px] font-extrabold text-yel">{CATEGORY_NAME[open.cat]}</span>
            <button onClick={() => setOpen(null)} className="ml-auto p-1 text-[13px] text-dim">
              閉じる
            </button>
          </div>

          <div className="min-h-0 flex-1 bg-[#10151B]">
            <ItemArt id={open.id} big />
          </div>

          <div className="flex-none overflow-y-auto px-4 pb-5 pt-4" style={{ maxHeight: "52vh" }}>
            <div className="text-[20px] font-black leading-snug">{open.nm}</div>
            <div className="mt-1 text-[12px] text-dim">{open.yomi}</div>

            {open.same && (
              <div className="mt-3 rounded-lg border border-cyan bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-cyan">
                呼び名は違っても、使う資材は同じ手摺だ。根がらみ手摺・落下防止手摺・上さん・中さんは同じ物を指す。
              </div>
            )}

            <div className="mt-3 grid gap-2.5">
              {[
                ["何をするもの", open.use],
                ["どこに付く", open.where],
                ["現場での注意", open.note],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line bg-panel px-3.5 py-3">
                  <div className="text-[10.5px] font-bold tracking-widest text-dim2">{k}</div>
                  <div className="mt-1 text-[13px] leading-relaxed">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
