"use client";
import type { Stage } from "@/stores/useLessonStore";

/* 4段（解説・図解・事例・確認）の現在地 */
export function StageNav({
  stage,
  figCount,
  caseCount,
}: {
  stage: Stage;
  figCount: number;
  caseCount: number;
}) {
  const steps: { k: Stage; n: string }[] = [
    { k: "narr", n: "解説" },
    ...(figCount ? [{ k: "fig" as Stage, n: `図解 ${figCount}` }] : []),
    ...(caseCount ? [{ k: "case" as Stage, n: `事例 ${caseCount}` }] : []),
    { k: "quiz", n: "確認" },
  ];
  return (
    <div className="flex gap-1 border-b border-line bg-panel px-4 py-2">
      {steps.map((s) => (
        <div
          key={s.k}
          className={`flex-1 rounded border py-1 text-center text-[11px] font-extrabold ${
            stage === s.k ? "border-yel bg-yel text-bg" : "border-line text-dim"
          }`}
        >
          {s.n}
        </div>
      ))}
    </div>
  );
}
