"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadProgress, type ProgressState } from "@/lib/progressClient";
import { Bar } from "@/components/ui/Bar";
import { hm } from "@/components/ui/format";

type LessonRow = { id: string; title: string; legal_min: number; figures: number; cases: number; quiz: number };
type SubjectRow = { id: number; name: string; legal_min: number; lessons: LessonRow[] };

export function LessonList({
  meta,
  subjects,
}: {
  meta: { title: string; basis: string };
  subjects: SubjectRow[];
}) {
  const [prog, setProg] = useState<Record<string, ProgressState>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = subjects.flatMap((s) => s.lessons.map((l) => l.id));
      const entries = await Promise.all(ids.map(async (id) => [id, await loadProgress(id)] as const));
      if (alive) setProg(Object.fromEntries(entries));
    })();
    return () => {
      alive = false;
    };
  }, [subjects]);

  const mode = Object.values(prog)[0]?.mode;

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pb-4 pt-6">
        <Link href="/" className="text-[13px] text-dim no-underline">
          ← ホーム
        </Link>
        <h1 className="mt-2 text-[18px] font-black leading-snug">{meta.title}</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-dim">{meta.basis}</p>
        {mode === "local" && (
          <p className="mt-2 inline-block rounded border border-org px-1.5 py-0.5 text-[11px] text-org">
            端末内記録（Supabase 未設定のため、視聴記録はこの端末にだけ保存されます）
          </p>
        )}
      </div>

      {subjects.map((s) => (
        <section key={s.id} className="mb-5 px-5">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-[12px] text-yel">科目{s.id}</span>
            <span className="text-[14px] font-extrabold">{s.name}</span>
            <span className="ml-auto shrink-0 text-[11px] text-dim">{hm(s.legal_min * 60)}</span>
          </div>
          <div className="grid gap-2">
            {s.lessons.map((l) => {
              const p = prog[l.id];
              const need = l.legal_min * 60;
              const watched = p?.watchedSec ?? 0;
              const done = !!p?.quizPassedAt;
              return (
                <Link
                  key={l.id}
                  href={`/edu/${l.id}`}
                  className={`block rounded-xl border bg-panel p-3.5 no-underline ${
                    done ? "border-grn" : "border-line"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[12px] text-dim">{l.id}</span>
                    <span className="text-[14px] font-extrabold leading-snug text-txt">{l.title}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1">
                      <Bar
                        v={watched}
                        max={need}
                        color={done ? "var(--color-grn)" : "var(--color-yel)"}
                      />
                    </div>
                    <span className={`shrink-0 font-mono text-[11px] ${done ? "text-grn" : "text-dim"}`}>
                      {done ? "修了" : `${hm(watched)} / ${hm(need)}`}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-dim2">
                    図解{l.figures}・事例{l.cases}・確認{l.quiz}問
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
