"use client";

import { mmss } from "@/training/score";
import type { Pop } from "./useScore";

/* プロトタイプの HUD（SCORE ／ コンボ ／ 技能 ／ 経過時間）をそのまま移したもの */
export function Hud({
  score,
  combo,
  mult,
  skill,
  sec,
}: {
  score: number;
  combo: number;
  mult: number;
  skill: number;
  sec: number;
}) {
  const skillColor = skill >= 80 ? "text-grn" : skill >= 60 ? "text-yel" : "text-red";
  return (
    <div className="flex items-center gap-2.5 border-b border-line bg-panel px-3.5 py-2">
      <div>
        <div className="text-[9px] tracking-[1px] text-dim">SCORE</div>
        <div className="font-mono text-[16px] font-bold leading-none text-yel" data-testid="hud-score">
          {score}
        </div>
      </div>
      {combo >= 2 && (
        <div
          key={combo}
          className="combo rounded-md bg-yel px-2 py-[3px] font-mono text-[13px] font-black text-bg"
          data-testid="hud-combo"
        >
          {combo} COMBO ×{mult}
        </div>
      )}
      <div className="ml-auto text-right">
        <div className="text-[9px] tracking-[1px] text-dim">技能</div>
        <div className={`font-mono text-[16px] font-bold leading-none ${skillColor}`} data-testid="hud-skill">
          {skill}
        </div>
      </div>
      <div className="font-mono text-[12px] text-dim" data-testid="hud-time">
        {mmss(sec)}
      </div>
    </div>
  );
}

/** 盤面の上に出る点の吹き出し */
export function PopText({ pop }: { pop: Pop | null }) {
  if (!pop) return null;
  return (
    <div
      key={pop.id}
      className={`pop pointer-events-none absolute left-1/2 top-3.5 z-[5] -translate-x-1/2 font-mono text-[22px] font-extrabold ${
        pop.k === "g" ? "text-grn" : "text-red"
      }`}
      style={{ textShadow: "0 2px 8px #000" }}
    >
      {pop.t}
    </div>
  );
}
