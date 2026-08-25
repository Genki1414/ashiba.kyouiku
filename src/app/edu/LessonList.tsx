"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadProgress, type ProgressState } from "@/lib/progressClient";
import { loadPrep, prepDone, type PrepState } from "@/lib/prep";
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
  const [prep, setPrep] = useState<PrepState | null>(null);

  useEffect(() => {
    /* 準備は人ごとに分けて持っている。誰として使っているかを見てから読む */
    let alive = true;
    void loadPrep().then((p) => { if (alive) setPrep(p); });
    return () => { alive = false; };
  }, []);

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
  const allIds = subjects.flatMap((sub) => sub.lessons.map((l) => l.id));
  const doneCount = allIds.filter((id) => prog[id]?.quizPassedAt).length;
  const allDone = Object.keys(prog).length > 0 && doneCount === allIds.length;

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pb-4 pt-6">
        <Link href="/" className="backlink text-[13px] text-dim no-underline">
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

      {prep && (
        <div className="mb-4 px-5">
          <Link
            href="/edu/prep"
            className={`block rounded-xl border bg-panel p-3.5 no-underline ${
              prepDone(prep) ? (prep.skipped ? "border-org" : "border-grn") : "border-yel"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-txt">受講の準備（同意・本人確認）</span>
              <span
                className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] ${
                  prepDone(prep)
                    ? prep.skipped
                      ? "border-org text-org"
                      : "border-grn text-grn"
                    : "border-yel text-yel"
                }`}
              >
                {prepDone(prep) ? (prep.skipped ? "記録は無効（見るだけ）" : "登録済み") : "未登録"}
              </span>
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-dim">
              {prepDone(prep)
                ? prep.skipped
                  ? "カメラを使わない閲覧モードです。正式な受講にするにはタップして登録してください。"
                  : `受講者：${prep.who.name}。受講中はカメラで本人確認を行います。`
                : "受講を始める前に、カメラの使用への同意と本人確認の登録が必要です。"}
            </div>
          </Link>
        </div>
      )}

      {subjects.map((s) => (
        <section key={s.id} className="mb-5 px-5">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="shrink-0 whitespace-nowrap font-mono text-[12px] text-yel">科目{s.id}</span>
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
      <div className="px-5">
        {allDone ? (
          <Link
            href="/edu/exam"
            className="block rounded-xl border border-yel bg-panel p-4 no-underline"
          >
            <div className="text-[11px] font-extrabold tracking-widest text-yel">修了試験</div>
            <div className="mt-1 text-[15px] font-black text-txt">全単元を修了しました。受験できます</div>
            <div className="mt-1 text-[12px] text-dim">全20問・16問以上で合格</div>
          </Link>
        ) : (
          <div className="rounded-xl border border-line bg-panel p-4 opacity-70">
            <div className="text-[11px] font-extrabold tracking-widest text-dim">修了試験</div>
            <div className="mt-1 text-[13px] leading-relaxed text-dim">
              すべての単元の確認問題に合格すると受験できます（残り {allIds.length - doneCount} 単元）。
            </div>
          </div>
        )}

        {/* 修了証。試験に受かっていれば出せる */}
        <Link
          href="/edu/cert"
          className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        >
          修了証を見る
        </Link>
      </div>
    </main>
  );
}
