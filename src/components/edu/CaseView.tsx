"use client";
import { useState } from "react";
import type { CaseStudy } from "@/types/curriculum";
import { Btn } from "@/components/ui/Btn";

/* 災害事例。① 発生状況を1行ずつ読む → ② 原因を考えて選ぶ → ③ 原因と再発防止 */
export function CaseView({ cs, index, total, onDone }: { cs: CaseStudy; index: number; total: number; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [line, setLine] = useState(1);
  const [pick, setPick] = useState<number | null>(null);
  const picked = pick !== null ? cs.options[pick] : null;

  return (
    <div>
      <div className="border-b border-red bg-[#1A1114] px-4 py-3.5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] tracking-widest text-red">災害事例 {cs.id}</span>
          <span className="font-mono text-[11px] text-dim2">{index + 1}/{total}</span>
        </div>
        <div className="text-[16px] font-black leading-snug">{cs.t}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(cs.meta).map(([k, v]) => (
            <span key={k} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-dim">
              {k}：{v}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="mb-2 text-[11px] tracking-[2px] text-dim">① 発生状況</div>
        {cs.situation.slice(0, line).map((s, i) => (
          <div
            key={i}
            className="fade mb-2 rounded-lg border border-line border-l-[3px] border-l-red bg-panel px-3 py-2.5 text-[13.5px] leading-relaxed"
          >
            {s}
          </div>
        ))}
        {line < cs.situation.length && (
          <Btn onClick={() => setLine((v) => v + 1)} className="mt-1">
            続きを読む（{line}/{cs.situation.length}）
          </Btn>
        )}

        {line >= cs.situation.length && step === 0 && (
          <Btn tone="y" onClick={() => setStep(1)} className="mt-3">
            原因を考える
          </Btn>
        )}

        {step >= 1 && (
          <div className="fade mt-5">
            <div className="mb-2 text-[11px] tracking-[2px] text-yel">② 原因を考える</div>
            <div className="mb-3 text-[15px] font-extrabold leading-relaxed">{cs.ask}</div>
            <div className="grid gap-2">
              {cs.options.map((o, i) => {
                const sel = pick === i;
                return (
                  <button
                    key={i}
                    data-case-opt
                    onClick={() => {
                      setPick(i);
                      if (o.ok) setStep(2);
                    }}
                    className={`rounded-lg border p-3.5 text-left text-[14px] font-bold leading-normal ${
                      sel
                        ? o.ok
                          ? "border-grn bg-ok-bg text-ok-tx"
                          : "border-red bg-ng-bg text-ng-tx"
                        : "border-line bg-panel2 text-txt"
                    }`}
                  >
                    {o.t}
                  </button>
                );
              })}
            </div>
            {picked && (
              <div className={`fade mt-2.5 text-[13px] leading-relaxed ${picked.ok ? "text-grn" : "text-ng-tx"}`}>
                {picked.fb}
              </div>
            )}
          </div>
        )}

        {step >= 2 && (
          <div className="fade mt-5">
            <div className="mb-2 text-[11px] tracking-[2px] text-red">③ 災害発生原因</div>
            {cs.causes.map((c, i) => (
              <div key={i} className="mb-1.5 flex gap-2.5 rounded-lg border border-line bg-panel px-3 py-2.5">
                <span className="font-mono text-[12px] text-red">{i + 1}</span>
                <span className="text-[13.5px] leading-relaxed">{c}</span>
              </div>
            ))}
            <div className="mb-2 mt-4 text-[11px] tracking-[2px] text-grn">再発防止対策</div>
            {cs.prevention.map((c, i) => (
              <div key={i} className="mb-1.5 flex gap-2.5 rounded-lg border border-line bg-panel px-3 py-2.5">
                <span className="font-mono text-[12px] text-grn">{i + 1}</span>
                <span className="text-[13.5px] leading-relaxed">{c}</span>
              </div>
            ))}
            <div className="mt-3.5 rounded-lg border border-yel bg-[#1A1F14] px-3.5 py-3 text-[14px] leading-relaxed text-yel">
              {cs.lesson}
            </div>
            <Btn tone="y" onClick={onDone} className="mt-4" testid="case-next">
              次へ
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
