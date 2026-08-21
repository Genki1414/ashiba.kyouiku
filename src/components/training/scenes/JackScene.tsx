"use client";

import { useState } from "react";
import { JACK_TARGET, JACK_TOL, POSTS, type PostId } from "@/training/ch1/layout";
import { Btn } from "@/components/ui/Btn";

/* ジャッキ合わせ（HANDOFF.md 3章 ルール3）
   ジャッキの全長は変わらない。ネジ棒に沿ってハンドルだけが上下し、
   その高さに支柱の後端が乗る。ゲーム中2回だけ出す。 */

const MIN = 60;
const MAX = 240;
const STEP = 10;

export function JackScene({
  post,
  onDone,
  onCancel,
}: {
  post: PostId;
  onDone: (value: number) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(MIN);
  const ok = Math.abs(v - JACK_TARGET) <= JACK_TOL;

  /* 図：ネジ棒は固定、ハンドルだけが動く */
  const H = 200;
  const baseY = 210;
  const handleY = baseY - (v / MAX) * H;
  const targetY = baseY - (JACK_TARGET / MAX) * H;

  return (
    <div className="fixed inset-0 z-30 flex items-center bg-[#0C1015ee] p-5">
      <div className="w-full">
        <div className="mb-1 text-[11px] font-extrabold tracking-widest text-yel">
          支柱を挿す手前
        </div>
        <div className="mb-3 text-[17px] font-black leading-snug">
          計算で出した高さに、ハンドルを合わせろ。
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-[#10151B]">
          <svg viewBox="0 0 260 250" preserveAspectRatio="xMidYMid meet" className="block w-full">
            {/* 地面と敷板 */}
            <rect y={baseY + 6} width="260" height="34" fill="#1A2027" />
            <polygon points={`96,${baseY + 6} 130,${baseY - 6} 164,${baseY + 6} 130,${baseY + 18}`} fill="var(--color-steel-dk)" />
            {/* ネジ棒（全長は変わらない） */}
            <line x1="130" y1={baseY} x2="130" y2={baseY - H} stroke="var(--color-steel-dk)" strokeWidth="7" />
            {Array.from({ length: 14 }, (_, i) => baseY - 8 - i * 14).map((y) => (
              <line key={y} x1="124" y1={y} x2="136" y2={y - 3} stroke="#4A555F" strokeWidth="1.5" />
            ))}
            {/* 目標の高さ */}
            <line x1="60" y1={targetY} x2="200" y2={targetY} stroke="var(--color-grn)" strokeWidth="1.5" strokeDasharray="5 5" />
            <text x="204" y={targetY + 4} fontSize="11" fill="var(--color-grn)">
              {JACK_TARGET}
            </text>
            {/* ハンドル（これだけが上下する） */}
            <g style={{ transition: "transform .18s" }}>
              <ellipse cx="130" cy={handleY} rx="30" ry="8" fill={ok ? "var(--color-grn)" : "var(--color-steel)"} />
              <ellipse cx="130" cy={handleY - 4} rx="30" ry="8" fill={ok ? "#2FCE7E" : "var(--color-steel-lt)"} />
              {/* 支柱の後端が乗る位置 */}
              <line x1="130" y1={handleY - 8} x2="130" y2={handleY - 46} stroke="var(--color-steel)" strokeWidth="6" opacity=".45" />
            </g>
            <text x="16" y="26" fontSize="12" fill="var(--color-dim)">
              {POSTS[post].n}
            </text>
            <text x="16" y="44" fontSize="11" fill="var(--color-dim2)">
              いま {v} / 目標 {JACK_TARGET}
            </text>
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn onClick={() => setV((x) => Math.max(MIN, x - STEP))}>◀ 下げる</Btn>
          <Btn onClick={() => setV((x) => Math.min(MAX, x + STEP))}>上げる ▶</Btn>
        </div>

        <div className="mt-3 text-[12px] leading-relaxed text-dim">
          ジャッキの全長は変わらん。ネジ棒に沿ってハンドルだけが上下して、
          その高さに支柱の後端が乗る。高さは足場の高さ計算から出す。
        </div>

        <Btn tone={ok ? "y" : undefined} dis={!ok} onClick={() => onDone(v)} className="mt-3">
          {ok ? "この高さで挿す" : "まだ合っとらん"}
        </Btn>
        <button onClick={onCancel} className="mt-2 w-full p-2 text-[12px] text-dim2">
          やめる
        </button>
      </div>
    </div>
  );
}
