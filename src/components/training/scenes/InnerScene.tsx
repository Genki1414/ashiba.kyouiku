"use client";

import { POSTS, type PostId } from "@/training/ch1/layout";
import { Btn } from "@/components/ui/Btn";

/* 内柱の箇所（HANDOFF.md 3章 ルール7）
   内柱を立てる → 踏板高さの600手摺でつなぐ → 離れ → 水平
   このとき水平器は「支柱」に当てる。 */

const CHOICES = [
  {
    k: "tie",
    t: "踏板高さの600手摺でつなぐ",
    ok: true,
    fb: "そうだ。つないでから離れと水平を見る。内柱の水平器は支柱に当てる。",
  },
  {
    k: "deck",
    t: "先に踏板を敷く",
    ok: false,
    fb: "まだ早い。つないでいない内柱の上に踏板を載せても、受けが決まっとらん。",
  },
  {
    k: "next",
    t: "次の柱へ進む",
    ok: false,
    fb: "内柱を立てただけで放るな。つないで水平を出すまでが1箇所だ。",
  },
] as const;

export function InnerScene({
  post,
  picked,
  onPick,
  onDone,
}: {
  post: PostId;
  picked: string | null;
  onPick: (k: string) => void;
  onDone: () => void;
}) {
  const cur = CHOICES.find((c) => c.k === picked) ?? null;

  return (
    <div className="fixed inset-0 z-30 flex items-center bg-[#0C1015ee] p-5">
      <div className="w-full">
        <div className="mb-1 text-[11px] font-extrabold tracking-widest text-yel">
          内柱を立てた　{POSTS[post].n}
        </div>
        <div className="mb-3 text-[17px] font-black leading-snug">次にどうする？</div>

        <div className="overflow-hidden rounded-xl border border-line bg-[#10151B]">
          <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet" className="block w-full">
            <rect y="170" width="300" height="30" fill="#1A2027" />
            {/* 外柱と内柱。内柱〜外柱＝600mm */}
            <line x1="200" y1="170" x2="200" y2="30" stroke="var(--color-steel)" strokeWidth="8" />
            <line x1="130" y1="170" x2="130" y2="86" stroke="var(--color-steel)" strokeWidth="6" />
            <text x="196" y="24" fontSize="10.5" fill="var(--color-dim)" textAnchor="middle">外柱</text>
            <text x="126" y="78" fontSize="10.5" fill="var(--color-dim)" textAnchor="middle">内柱</text>
            {/* 600の寸法 */}
            <line x1="130" y1="150" x2="200" y2="150" stroke="var(--color-cyan)" strokeWidth="1.2" />
            <text x="165" y="145" fontSize="10.5" fill="var(--color-cyan)" textAnchor="middle">600</text>
            {/* 踏板高さの600手摺（つなぐ先） */}
            <line x1="130" y1="86" x2="200" y2="86" stroke="var(--color-cyan)" strokeWidth="4" strokeDasharray="6 4" opacity=".7" />
            <text x="165" y="80" fontSize="10" fill="var(--color-cyan)" textAnchor="middle">ここでつなぐ</text>
          </svg>
        </div>

        {cur && (
          <div
            className={`fade mt-3 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed ${
              cur.ok ? "border-grn bg-ok-bg text-ok-tx" : "border-red bg-ng-bg text-ng-tx"
            }`}
          >
            {cur.fb}
          </div>
        )}

        <div className="mt-3 grid gap-2">
          {CHOICES.map((c) => (
            <Btn key={c.k} onClick={() => onPick(c.k)}>
              {c.t}
            </Btn>
          ))}
        </div>

        {cur?.ok && (
          <Btn tone="y" onClick={onDone} className="mt-3">
            つないで水平を出す
          </Btn>
        )}
      </div>
    </div>
  );
}
