"use client";

import { useState } from "react";
import { JACK_TARGET, JACK_TOL, POSTS, type PostId } from "@/training/ch1/layout";
import { Btn } from "@/components/ui/Btn";

/* ジャッキ合わせ（HANDOFF.md 3章 ルール3）
   プロトタイプの JackZoom をそのまま移植。
   上下の帯を固定し、図だけが縮む作りなので、どの画面でもボタンに手が届く。

   足場の高さを計算してジャッキの出し高さを出し、
   支柱を挿す手前で、その高さ付近にハンドルを合わせる。 */

const MIN = -60;
const MAX = 260;

export function JackScene({
  post,
  onDone,
}: {
  post: PostId;
  onDone: (value: number) => void;
}) {
  const [val, setVal] = useState(0);
  const d = val - JACK_TARGET;
  const ok = Math.abs(d) <= JACK_TOL;
  const y = (mm: number) => 172 - mm * 0.52;
  const move = (dd: number) => setVal((v) => Math.max(MIN, Math.min(MAX, v + dd)));

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0C1015]">
      <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-[12px] font-extrabold text-yel">ハンドルの高さ</span>
        <span className="text-[11px] text-dim">{POSTS[post].n}</span>
        <span data-testid="jack-now" data-value={val} className={`ml-auto font-mono text-[12px] ${ok ? "text-grn" : "text-txt"}`}>
          いま {val} / 目標 {JACK_TARGET} mm
        </span>
      </div>

      <svg
        viewBox="0 0 340 200"
        preserveAspectRatio="xMidYMid meet"
        className="block min-h-0 w-full flex-1"
      >
        <rect width="340" height="200" fill="#0C1015" />
        <rect x="0" y={y(0)} width="340" height={200 - y(0)} fill="#1A2027" />
        <line x1="0" y1={y(0)} x2="340" y2={y(0)} stroke="#39434D" strokeWidth="2" />

        {/* 目標の帯 */}
        <rect
          x="60"
          y={y(JACK_TARGET + JACK_TOL)}
          width="230"
          height={y(JACK_TARGET - JACK_TOL) - y(JACK_TARGET + JACK_TOL)}
          fill="var(--color-yel)"
          opacity=".13"
        />
        <line
          x1="60"
          y1={y(JACK_TARGET)}
          x2="290"
          y2={y(JACK_TARGET)}
          stroke="var(--color-yel)"
          strokeWidth="1.6"
          strokeDasharray="6 5"
        />
        <text x="290" y={y(JACK_TARGET) - 8} textAnchor="end" fontSize="10.5" fill="var(--color-yel)">
          計算で出した高さ {JACK_TARGET}
        </text>

        {/* 目盛 */}
        {[0, 50, 100, 150, 200, 250].map((mm) => (
          <g key={mm}>
            <line x1="52" y1={y(mm)} x2="60" y2={y(mm)} stroke="var(--color-dim2)" strokeWidth="1" />
            <text
              x="48"
              y={y(mm) + 4}
              textAnchor="end"
              fontSize="9.5"
              fill="var(--color-dim2)"
              className="font-mono"
            >
              {mm}
            </text>
          </g>
        ))}

        {/* ジャッキ本体。全長は変わらない */}
        <rect x="134" y={y(0) - 4} width="72" height="11" rx="2" fill="#CBD6DF" />
        <rect x="163" y={y(300)} width="14" height={y(0) - y(300)} fill="#93A0AD" />
        {Array.from({ length: 20 }, (_, i) => (
          <line
            key={i}
            x1="161"
            y1={y(0) - 8 - i * 7.3}
            x2="179"
            y2={y(0) - 8 - i * 7.3}
            stroke="#5F6B78"
            strokeWidth="2"
          />
        ))}

        {/* ハンドル（これだけが上下する） */}
        <rect x="146" y={y(val) - 6} width="48" height="13" rx="3" fill={ok ? "var(--color-grn)" : "#7E8A96"} />
        <line
          x1="196"
          y1={y(val)}
          x2="238"
          y2={y(val)}
          stroke={ok ? "var(--color-grn)" : "var(--color-txt)"}
          strokeWidth="1.2"
        />
        <text x="242" y={y(val) + 4} fontSize="10.5" fill={ok ? "var(--color-grn)" : "var(--color-txt)"}>
          ハンドル
        </text>
        <text x="242" y={y(val) + 18} fontSize="9.5" fill="var(--color-dim2)">
          ここに支柱の後端
        </text>
      </svg>

      <div className="flex-none px-4 pb-4 pt-3">
        <div className={`mb-2.5 text-[12.5px] leading-relaxed ${ok ? "text-grn" : "text-dim"}`}>
          {ok
            ? "その高さでいい。柱を挿せ。"
            : d > 0
              ? "ハンドルが高い。少し下げろ。"
              : "ハンドルが低い。もう少し上げろ。"}
        </div>
        <div className="mb-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-dim">
          ジャッキの全長は変わらない。ネジ棒に沿ってハンドルだけが上下し、その高さに支柱の後端が乗る。
          足場の高さを計算して出した高さ付近へハンドルを合わせてから柱を挿す。
          <br />
          高さの計算は積算アプリで出せる。
        </div>
        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <Btn onClick={() => move(-10)}>下げる（10）</Btn>
          <Btn onClick={() => move(10)}>上げる（10）</Btn>
        </div>
        <Btn tone={ok ? "y" : undefined} onClick={() => ok && onDone(val)}>
          {ok ? "柱を挿す" : "まだ合っていない"}
        </Btn>
      </div>
    </div>
  );
}
