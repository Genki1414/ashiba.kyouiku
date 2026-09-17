"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Lesson, Subject } from "@/types/curriculum";
import type { Stage } from "@/stores/useLessonStore";
import { StageNav } from "@/components/edu/StageNav";
import { NarrationView } from "@/components/edu/NarrationView";
import { FigureView } from "@/components/edu/FigureView";
import { CaseView } from "@/components/edu/CaseView";
import { QuizView } from "@/components/edu/QuizView";
import { yen } from "@/lib/pricing";

/* 無料の1単元（0039）。見るだけ。

   本番の受講画面（LessonClient）と同じ部品で、同じ順に進む
   （解説 → 図解 → 事例 → 確認問題）。違うのは次の3つだけ。
     ・時間を数えない。合格を記録しない。サーバに何も送らない
     ・顔の照合をしない
     ・確認問題は解けるが、結果は残らない
   終わったら、申し込む道を出す。 */

export function TryClient({
  course,
  subject,
  lesson,
  lessons,
  total,
  others,
}: {
  course: { id: string; name: string; short: string };
  subject: Subject;
  lesson: Lesson;
  /** この講座の単元の数 */
  lessons: number;
  /** 1名分の税込 */
  total: number;
  /** ほかに試せる講座の数 */
  others: number;
}) {
  const [stage, setStage] = useState<Stage>("narr");
  const [line, setLine] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [fi, setFi] = useState(0);
  const [ci, setCi] = useState(0);
  const [passed, setPassed] = useState(false);

  const nextStage = useCallback(() => {
    setPlaying(false);
    const figN = lesson.figures.length;
    const caseN = lesson.cases.length;
    setStage((st) => {
      if (st === "narr") return figN ? "fig" : caseN ? "case" : "quiz";
      if (st === "fig") return caseN ? "case" : "quiz";
      return "quiz";
    });
  }, [lesson]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage, fi, ci]);

  const cta = (
    <div className="mx-4 mt-6 rounded-xl border border-yel bg-[#1A1F14] p-4" data-testid="try-cta">
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">続きを受けるには</div>
      <div className="mt-1 text-[15px] font-black text-txt">
        {course.name}
      </div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-dim">
        全{lessons}単元。1名分 {yen(total)}（税込）。
        <br />
        受講中は顔の照合があり、修了すると修了証が出ます。
      </div>
      <Link
        href={`/solo?courseId=${encodeURIComponent(course.id)}`}
        className="mt-3 block rounded-lg border border-yel bg-yel p-3.5 text-center text-[14px] font-extrabold text-bg no-underline"
        data-testid="try-solo"
      >
        ひとりで受ける（会社の登録は要りません）
      </Link>
      <Link
        href="/join"
        className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        data-testid="try-join"
      >
        会社から受講コードをもらっている方は、こちら
      </Link>
    </div>
  );

  return (
    <div className="pb-10" data-testid="try">
      {/* ヘッダ。時計は出さない（数えていない） */}
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/try" className="backlink-bar text-[16px] text-dim no-underline">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dim">
            {course.short}　科目{subject.id}　{lesson.id}
          </div>
          <div className="truncate text-[14px] font-extrabold leading-snug">{lesson.title}</div>
        </div>
        <span className="rounded border border-cyan px-1.5 py-0.5 text-[11px] font-bold text-cyan" data-testid="try-badge">
          お試し
        </span>
      </div>

      <div className="border-b border-line bg-panel px-4 py-2.5 text-[12px] leading-relaxed text-dim" data-testid="try-note">
        第1単元を、ログインなしで見られます。<span className="text-txt">時間も合格も記録しません。</span>
        本番の受講は、申し込んでから始まります。
      </div>

      <StageNav stage={stage} figCount={lesson.figures.length} caseCount={lesson.cases.length} />

      {stage === "narr" && (
        <NarrationView
          lesson={lesson}
          line={line}
          playing={playing}
          onLine={setLine}
          onPlaying={setPlaying}
          onFinished={nextStage}
          devPlus={null}
        />
      )}

      {stage === "fig" && lesson.figures[fi] && (
        <FigureView
          key={lesson.figures[fi].id}
          fig={lesson.figures[fi]}
          index={fi}
          total={lesson.figures.length}
          onDone={() => {
            if (fi + 1 < lesson.figures.length) setFi(fi + 1);
            else nextStage();
          }}
        />
      )}

      {stage === "case" && lesson.cases[ci] && (
        <CaseView
          key={lesson.cases[ci].id}
          cs={lesson.cases[ci]}
          index={ci}
          total={lesson.cases.length}
          onDone={() => {
            if (ci + 1 < lesson.cases.length) setCi(ci + 1);
            else nextStage();
          }}
        />
      )}

      {stage === "quiz" && (
        <>
          {/* 規定時間の関門は掛けない（数えていないので）。解けるが、残らない */}
          <QuizView
            lesson={lesson}
            passed={passed}
            passError={null}
            watchedSec={lesson.legal_min * 60}
            needSec={lesson.legal_min * 60}
            onAllCorrect={() => setPassed(true)}
            onBackToNarr={() => setStage("narr")}
          />
          {passed && (
            <div className="mx-4 mt-3 rounded-lg border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-dim" data-testid="try-passed">
              お試しなので、この合格は記録に残りません。本番では、規定の時間を見てから確認問題に進みます。
            </div>
          )}
        </>
      )}

      {cta}

      {others > 0 && (
        <Link href="/try" className="mt-4 block text-center text-[12.5px] text-dim2 no-underline" data-testid="try-others">
          ほかの講座も試す（{others}講座）
        </Link>
      )}
    </div>
  );
}
