"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Lesson, Subject } from "@/types/curriculum";
import { useLessonStore } from "@/stores/useLessonStore";
import { loadProgress, syncDelta, markQuizPassed } from "@/lib/progressClient";
import { StageNav } from "@/components/edu/StageNav";
import { NarrationView } from "@/components/edu/NarrationView";
import { FigureView } from "@/components/edu/FigureView";
import { CaseView } from "@/components/edu/CaseView";
import { QuizView } from "@/components/edu/QuizView";
import { LockedNotice } from "@/components/edu/LockedNotice";
import { Bar } from "@/components/ui/Bar";
import { hm } from "@/components/ui/format";
import { loadPrep, prepDone } from "@/lib/prep";
import { useVerification } from "@/lib/useVerification";
import { CamWindow } from "@/components/edu/CamWindow";
import { VerifyModal } from "@/components/edu/VerifyModal";

const SYNC_INTERVAL_SEC = 15;

/* 受講画面の本体。
   段の遷移（narr → fig → case → quiz）と、
   「再生中のみ進む時計」（ナレーション再生中＋図解・事例の表示中に加算）を持つ。 */
export function LessonClient({
  subject,
  lesson,
  prevId,
  nextId,
}: {
  subject: Subject;
  lesson: Lesson;
  prevId: string | null;
  nextId: string | null;
}) {
  const router = useRouter();
  const s = useLessonStore();
  const [loaded, setLoaded] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const needSec = lesson.legal_min * 60;

  /* 受講の準備（同意・本人確認）が済んでいなければ先にそちらへ */
  const [prepState, setPrepState] = useState<"checking" | "cam" | "nocam">("checking");
  /* 受講の準備で登録した顔。受講中はこれと比べる（端末の中だけにある） */
  const [registered, setRegistered] = useState<number[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPrep().then((p) => {
      if (!alive) return;
      if (!prepDone(p)) {
        router.replace(`/edu/prep?back=${lesson.id}`);
        return;
      }
      setRegistered(p.faceDescriptor);
      setPrepState(p.skipped ? "nocam" : "cam");
    });
    return () => { alive = false; };
  }, [lesson.id, router]);

  /* 開発時のみ：E2Eテストから状態を動かせるように store を window へ出す */
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__lessonStore = useLessonStore;
    }
  }, []);

  /* 初期化：単元を開いたら記録を読み込む */
  useEffect(() => {
    s.reset(lesson.id);
    let alive = true;
    loadProgress(lesson.id).then((p) => {
      if (!alive) return;
      useLessonStore.getState().set({
        mode: p.mode,
        watchedSec: p.watchedSec,
        quizPassedAt: p.quizPassedAt,
      });
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  /* 受講中の照合（カメラあり）／在席確認（カメラなし） */
  const verification = useVerification({
    lessonId: lesson.id,
    counting:
      loaded &&
      prepState !== "checking" &&
      (s.stage === "narr" ? s.playing : s.stage === "fig" || s.stage === "case"),
    useCam: prepState === "cam",
    registered,
    onStop: () => useLessonStore.getState().set({ playing: false }),
  });

  /* 視聴時間：ナレーションは再生中のみ、図解・事例は表示中に加算（SPEC 5章）。
     照合失敗・在席確認で停止しているあいだは加算しない */
  /* 顔を見分けるモデルが読み込めるまでは、時間を数えない。
     見分けが付かないまま時間だけ積み上がると、受講の記録が意味を失う */
  const watching = prepState !== "cam" || verification.model === "ready";
  const counting =
    loaded &&
    prepState !== "checking" &&
    watching &&
    !verification.stop &&
    (s.stage === "narr" ? s.playing : s.stage === "fig" || s.stage === "case");
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => useLessonStore.getState().tick(), 1000);
    return () => clearInterval(id);
  }, [counting]);

  /* 同期：15秒ごと＋段の切り替わり時に、未送信ぶんをサーバへ */
  const flush = useCallback(async () => {
    const st = useLessonStore.getState();
    const sent = st.pendingSec;
    if (sent <= 0) return;
    const r = await syncDelta(lesson.id, sent, st.watchedSec);
    useLessonStore.getState().flushed(r.watchedSec, sent, r.mode);
  }, [lesson.id]);

  useEffect(() => {
    const id = setInterval(flush, SYNC_INTERVAL_SEC * 1000);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [flush]);

  const nextStage = useCallback(() => {
    const st = useLessonStore.getState();
    const figN = lesson.figures.length;
    const caseN = lesson.cases.length;
    st.set({ playing: false });
    if (st.stage === "narr") st.set({ stage: figN ? "fig" : caseN ? "case" : "quiz" });
    else if (st.stage === "fig") st.set({ stage: caseN ? "case" : "quiz" });
    else if (st.stage === "case") st.set({ stage: "quiz" });
    flush();
  }, [lesson, flush]);

  const onAllCorrect = useCallback(async () => {
    setPassError(null);
    await flush();
    const st = useLessonStore.getState();
    const r = await markQuizPassed(lesson.id, needSec, st.watchedSec);
    if (r.ok) st.set({ quizPassedAt: r.quizPassedAt });
    else setPassError(r.error ?? "合格を記録できませんでした");
  }, [lesson.id, needSec, flush]);

  /* 段や枚数が切り替わったら先頭へ（縦に長い画面から移った直後に見切れないように） */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [s.stage, s.fi, s.ci]);

  const p = Math.min(1, s.watchedSec / needSec);
  const quizLocked = s.watchedSec < needSec && !s.quizPassedAt;

  return (
    <div className="pb-10">
      {/* ヘッダ */}
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Link href="/edu" className="backlink-bar text-[16px] text-dim no-underline">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-dim">
            科目{subject.id}　{lesson.id}
            {s.mode === "local" && loaded && (
              <span className="ml-2 rounded border border-org px-1 text-[11px] text-org">
                端末内記録
              </span>
            )}
          </div>
          <div className="truncate text-[14px] font-extrabold leading-snug">{lesson.title}</div>
        </div>
        <div className={`font-mono text-[12px] ${p >= 1 ? "text-grn" : "text-yel"}`}>
          {hm(s.watchedSec)}
          <span className="text-dim"> / {hm(needSec)}</span>
        </div>
      </div>

      <StageNav stage={s.stage} figCount={lesson.figures.length} caseCount={lesson.cases.length} />
      <Bar v={s.watchedSec} max={needSec} color={p >= 1 ? "var(--color-grn)" : "var(--color-yel)"} />

      {/* 受講中の照合（端末内で完結。映像は送信しない） */}
      {prepState === "cam" && (
        <>
          <CamWindow stream={verification.cam.stream} state={verification.camState} active={counting} />
          <video ref={verification.videoRef} autoPlay playsInline muted className="hidden" />
          <canvas ref={verification.canvasRef} className="hidden" />
          {verification.model !== "ready" && (
            <div
              className={`border-b border-line px-4 py-2.5 text-[12px] leading-relaxed ${
                verification.model === "failed" ? "bg-ng-bg text-ng-tx" : "bg-[#1A1F14] text-yel"
              }`}
              data-testid="face-model"
            >
              {verification.model === "failed"
                ? "顔の照合の支度ができません。電波の届く所で開き直してください。支度ができるまで、視聴時間は加算されません。"
                : "顔の照合の支度をしています（はじめの1回だけ、少し時間がかかります）。済むまで視聴時間は加算されません。"}
            </div>
          )}
          {!verification.cam.stream && (
            <div className="flex items-center justify-between gap-3 border-b border-line bg-ng-bg px-4 py-2.5">
              <span className="text-[12px] leading-snug text-ng-tx">
                {verification.cam.error ?? "受講中は、画面の前に居るかをカメラで確かめます"}
              </span>
              <button
                onClick={verification.cam.start}
                className="shrink-0 rounded border border-line bg-panel2 px-3 py-1.5 text-[12px] text-txt"
              >
                カメラを起動
              </button>
            </div>
          )}
        </>
      )}
      {verification.stop && (
        <VerifyModal
          kind={verification.stop.kind}
          message={verification.stop.message}
          onResume={() => {
            verification.resume();
            if (s.stage === "narr") useLessonStore.getState().set({ playing: true });
          }}
        />
      )}

      {s.stage === "narr" && (
        <NarrationView
          lesson={lesson}
          line={s.line}
          playing={s.playing}
          onLine={(n) => s.set({ line: n })}
          onPlaying={(v) => s.set({ playing: v })}
          onFinished={nextStage}
          devPlus={
            s.mode === "local" && loaded
              ? () =>
                  useLessonStore
                    .getState()
                    .set({ watchedSec: s.watchedSec + 60, pendingSec: s.pendingSec + 60 })
              : null
          }
        />
      )}

      {s.stage === "fig" && lesson.figures[s.fi] && (
        <FigureView
          key={lesson.figures[s.fi].id}
          fig={lesson.figures[s.fi]}
          index={s.fi}
          total={lesson.figures.length}
          onDone={() => {
            if (s.fi + 1 < lesson.figures.length) s.set({ fi: s.fi + 1 });
            else nextStage();
          }}
        />
      )}

      {s.stage === "case" && lesson.cases[s.ci] && (
        <CaseView
          key={lesson.cases[s.ci].id}
          cs={lesson.cases[s.ci]}
          index={s.ci}
          total={lesson.cases.length}
          onDone={() => {
            if (s.ci + 1 < lesson.cases.length) s.set({ ci: s.ci + 1 });
            else nextStage();
          }}
        />
      )}

      {s.stage === "quiz" &&
        (quizLocked ? (
          <>
            <LockedNotice watchedSec={s.watchedSec} needSec={needSec} />
            <div className="px-4">
              <button
                onClick={() => s.set({ stage: "narr" })}
                className="w-full rounded-lg border border-line p-3 text-[13px] text-dim"
              >
                解説に戻る
              </button>
            </div>
          </>
        ) : (
          <QuizView
            lesson={lesson}
            passed={!!s.quizPassedAt}
            passError={passError}
            watchedSec={s.watchedSec}
            needSec={needSec}
            onAllCorrect={onAllCorrect}
            onBackToNarr={() => s.set({ stage: "narr" })}
          />
        ))}

      {/* 前後の単元 */}
      <div className="mt-6 grid grid-cols-2 gap-2 px-4">
        {prevId ? (
          <Link
            href={`/edu/${prevId}`}
            className="rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline"
          >
            ← 前の単元
          </Link>
        ) : (
          <span />
        )}
        {nextId ? (
          <Link
            href={`/edu/${nextId}`}
            className="rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline"
          >
            次の単元 →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
