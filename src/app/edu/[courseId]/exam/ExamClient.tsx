"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui/Btn";
import { Bar } from "@/components/ui/Bar";
import { loadProgress } from "@/lib/progressClient";

type ExamQ = { q: string; a: string[] };
type ExamResult = {
  score: number;
  total: number;
  passRequired: number;
  passed: boolean;
  attempt: number;
  wrong: { q: string; correct: string }[];
};

const TRIES_KEY = "ashiba.examTries";

export function ExamClient({ courseId, lessonIds }: { courseId: string; lessonIds: string[] }) {
  const [gate, setGate] = useState<"loading" | "locked" | "ready">("loading");
  const [remain, setRemain] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [qs, setQs] = useState<ExamQ[] | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* 受験資格：全単元の確認問題に合格していること */
  useEffect(() => {
    let alive = true;
    (async () => {
      const ps = await Promise.all(lessonIds.map((id) => loadProgress(courseId, id)));
      if (!alive) return;
      const missing = ps.filter((p) => !p.quizPassedAt).length;
      setRemain(missing);
      setGate(missing ? "locked" : "ready");
    })();
    return () => {
      alive = false;
    };
  }, [courseId, lessonIds]);

  const start = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/exam?courseId=${encodeURIComponent(courseId)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setToken(j.token);
      setQs(j.questions);
      setI(0);
      setAnswers([]);
      setResult(null);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "試験を開始できませんでした");
    }
  };

  const submit = async (finalAnswers: number[]) => {
    setError(null);
    try {
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers: finalAnswers }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setResult(j);
      setQs(null);
      try {
        const t = (JSON.parse(localStorage.getItem(TRIES_KEY) ?? "0") as number) + 1;
        localStorage.setItem(TRIES_KEY, String(t));
      } catch {
        /* 無視 */
      }
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "採点できませんでした");
    }
  };

  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Link href={`/edu/${courseId}`} className="backlink-bar text-[15px] text-dim no-underline">
          ←
        </Link>
        <div className="text-[14px] font-extrabold">修了試験</div>
        {qs && (
          <div className="ml-auto font-mono text-[12px] text-dim">
            {i + 1}/{qs.length}
          </div>
        )}
      </div>

      {gate === "locked" && (
        <div className="px-4">
          <div className="rounded-xl border border-line bg-panel p-4">
            <div className="mb-1.5 text-[11px] font-bold tracking-[2px] text-yel">まだ受験できません</div>
            <div className="text-[14px] leading-relaxed text-dim">
              すべての単元の確認問題に合格すると受験できます。
              <br />
              残り {remain} 単元です。
            </div>
          </div>
          <Link href={`/edu/${courseId}`} className="mt-3 block rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline">
            科目一覧へ戻る
          </Link>
        </div>
      )}

      {gate === "ready" && !qs && !result && (
        <div className="px-4">
          <div className="rounded-xl border border-line bg-panel p-4 text-[13.5px] leading-loose text-dim">
            全20問。16問以上（8割）で合格です。
            <br />
            全単元の確認問題と総合問題から、毎回ランダムに出題されます。
            <br />
            途中でやめた場合は、最初からやり直しになります。
          </div>
          <Btn tone="y" onClick={start} className="mt-4" testid="exam-start">
            試験を始める
          </Btn>
        </div>
      )}

      {qs && (
        <div className="px-4">
          <Bar v={i} max={qs.length} />
          <div data-testid="exam-q" className="mb-3.5 mt-4 text-[16px] font-extrabold leading-relaxed">{qs[i].q}</div>
          <div className="grid gap-2">
            {qs[i].a.map((a, k) => (
              <button
                key={k}
                data-exam-opt
                onClick={() => {
                  const n = [...answers];
                  n[i] = k;
                  setAnswers(n);
                  if (i + 1 >= qs.length) submit(n);
                  else {
                    setI(i + 1);
                    window.scrollTo(0, 0);
                  }
                }}
                className="rounded-lg border border-line bg-panel2 p-3.5 text-left text-[14px] font-bold leading-normal text-txt"
              >
                {a}
              </button>
            ))}
          </div>
          <div className="mt-4 text-[11px] leading-loose text-dim2">
            全{qs.length}問。16問以上で合格。全単元からランダムに出題されます。
          </div>
        </div>
      )}

      {result && (
        <div className="px-4">
          <div
            className={`rounded-xl border bg-panel p-5 text-center ${
              result.passed ? "border-grn" : "border-red"
            }`}
          >
            <div className="text-[11px] tracking-[3px] text-dim">修了試験</div>
            <div
              className={`font-mono text-[50px] font-bold leading-tight ${
                result.passed ? "text-grn" : "text-red"
              }`}
            >
              {result.score}
              <span className="text-[20px] text-dim">/{result.total}</span>
            </div>
            <div className="text-[16px] font-extrabold">{result.passed ? "合格" : "不合格"}</div>
            <div className="mt-1 text-[12px] text-dim">
              合格は{result.passRequired}問以上（
              {Math.round((result.passRequired / result.total) * 100)}％）　／　受験 {result.attempt}
              回目
            </div>
          </div>

          {!result.passed && result.wrong.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] tracking-[2px] text-yel">間違えた問題</div>
              {result.wrong.map((w, k) => (
                <div key={k} className="mb-2 rounded-lg border border-line bg-panel px-3 py-2.5">
                  <div className="mb-1 text-[13px] font-bold leading-relaxed">{w.q}</div>
                  <div className="text-[12.5px] text-grn">正解：{w.correct}</div>
                </div>
              ))}
              <div className="mt-2.5 text-[12px] leading-loose text-dim">
                該当する単元を見直してから、もう一度受験してください。出題は毎回ランダムに選ばれます。
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2">
            {result.passed ? (
              <Link
                href={`/edu/${courseId}/cert`}
                className="rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
              >
                修了証を出す
              </Link>
            ) : (
              <Btn tone="y" onClick={start}>
                もう一度受験する
              </Btn>
            )}
            <Link
              href={`/edu/${courseId}`}
              className="rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline"
            >
              科目一覧へ戻る
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red bg-ng-bg px-3 py-2.5 text-[13px] text-ng-tx">
          {error}
        </div>
      )}
    </main>
  );
}
