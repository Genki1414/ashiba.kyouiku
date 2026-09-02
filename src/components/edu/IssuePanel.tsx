"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn } from "@/components/ui/Btn";
import type { IssueStatus, NextAction, Slot } from "@/lib/issue";
import type { CourseGate } from "@/content/courses";

/* 修了証の発行申請（受講する人の側）。

   学科を見終わったら、ここから申請を出す。
   出したあとは自動で発行されない。こちらが討議の候補日を返し、
   本人が選んだ日に討議をやって、そこではじめて修了になる。

   状態はサーバが決める（/api/issue）。
   画面の側で「もう修了した」と決められないようにしてある。 */

type Info = {
  ok: true;
  gate: CourseGate | null;
  gateText?: { label: string; what: string };
  study: { lessons: number; lessonsPassed: number; examPassed: boolean; can: boolean; why: string };
  status: IssueStatus;
  slots: Slot[];
  note: string;
  replyNote: string;
  drillOn: string | null;
  drillBy: string;
  sessionId: string | null;
  reason: string;
  next: NextAction;
};

const jp = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const w = "日月火水木金土"[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）${hh}:${mm}`;
};

const STATUS_LABEL: Record<IssueStatus, string> = {
  none: "未申請",
  open: "申請中",
  offered: "候補日が届いています",
  picked: "日が決まりました",
  cleared: "修了",
  declined: "お返ししています",
};

export function IssuePanel({
  courseId,
  onChange,
  onGate,
}: {
  courseId: string;
  /** 状態が変わったとき（修了証の画面を読み直す） */
  onChange?: () => void;
  /** 関門のある講座かどうかを、親に知らせる。

      修了証の画面は、出せない理由を上の枠にも出す。
      関門の話はこの枠の中で状態ごとに書くので、
      知らせておかないと同じ文が2回並ぶ。 */
  onGate?: (gate: CourseGate | null) => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [note, setNote] = useState("");
  const [drillOn, setDrillOn] = useState("");
  const [drillBy, setDrillBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [ng, setNg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/issue?courseId=${encodeURIComponent(courseId)}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setNg(j.reason ?? "読み込めませんでした。");
        return;
      }
      setInfo(j as Info);
      onGate?.(j.gate ?? null);
      setNote(j.note ?? "");
      setDrillOn(j.drillOn ?? "");
      setDrillBy(j.drillBy ?? "");
      setNg("");
    } catch {
      setNg("つながりません。電波の届く所でもう一度。");
    }
  }, [courseId, onGate]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNg("");
    try {
      const r = await fetch("/api/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, ...body }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setNg(j.reason ?? "うまくいきませんでした。");
        return;
      }
      await load();
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  /* 関門の無い講座では、この枠ごと出さない */
  if (!info?.gate) return null;

  const { study, gate, next } = info;
  const left = study.lessons - study.lessonsPassed;

  return (
    <section
      className="mt-4 rounded-xl border border-line bg-panel p-4"
      data-testid="issue-panel"
      data-status={info.status}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-black">修了証の発行申請</h2>
        <span
          className="rounded-full border border-line px-2.5 py-1 text-[11px] text-dim"
          data-testid="issue-status"
        >
          {STATUS_LABEL[info.status]}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
        {info.gateText?.what}
      </p>

      {/* 学科がまだ終わっていないとき。何が残っているかを出す */}
      {!study.can && (
        <div
          className="mt-3 rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[12.5px] leading-relaxed text-dim"
          data-testid="issue-locked"
        >
          {study.why}
          {left > 0 && (
            <>
              <br />
              <span className="text-dim2">
                {study.lessonsPassed} ／ {study.lessons} 単元
              </span>
            </>
          )}
        </div>
      )}

      {/* いまの状態の説明 */}
      {study.can && info.reason && (
        <div
          className="mt-3 rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[12.5px] leading-relaxed"
          data-testid="issue-reason"
        >
          {info.reason}
        </div>
      )}

      {/* 候補日。選ぶのは本人、出すのはこちら */}
      {info.slots.length > 0 && (
        <div className="mt-3" data-testid="issue-slots">
          <div className="mb-1.5 text-[11.5px] text-dim">
            {info.status === "picked" ? "選んだ日" : "都合のよい日を選んでください"}
          </div>
          <div className="grid gap-2">
            {info.slots.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy || next !== "pick"}
                onClick={() => void post({ action: "pick", slotId: s.id })}
                data-testid="issue-slot"
                data-picked={s.picked ? "1" : "0"}
                className={`w-full rounded-lg border px-3.5 py-3 text-left text-[13.5px] ${
                  s.picked
                    ? "border-yel bg-ok-bg font-extrabold text-ok-tx"
                    : "border-line bg-panel2 text-txt disabled:text-dim"
                }`}
              >
                {jp(s.startsAt)}
                <span className="ml-2 text-[11.5px] text-dim">{s.minutes}分</span>
                {s.picked && <span className="ml-2 text-[11.5px]">← この日</span>}
                {s.note && (
                  <>
                    <br />
                    <span className="text-[11.5px] text-dim">{s.note}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {info.replyNote && (
        <div className="mt-3 rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[12.5px] leading-relaxed">
          <span className="text-dim2">こちらから：</span>
          <br />
          {info.replyNote}
        </div>
      )}

      {/* 申請の口。学科が終わっていて、まだ出していない（か、返された）とき */}
      {study.can && next === "request" && (
        <div className="mt-3 grid gap-3">
          {gate === "drill" && (
            <>
              <a
                href={`/edu/${courseId}/drill`}
                data-testid="issue-go-drill"
                className="block rounded-lg border border-line bg-panel2 px-3.5 py-2.5 text-[12.5px] leading-relaxed no-underline"
              >
                実技をまだ行っていなければ、先に
                <span className="font-bold text-cyan">実技の手引き</span>
                を会社の人に渡してください。何を何分やるか、記録の様式が入っています。
              </a>
              <label className="block">
                <span className="mb-1 block text-[11.5px] text-dim">実技を行った日</span>
                <input
                  type="date"
                  value={drillOn}
                  onChange={(e) => setDrillOn(e.target.value)}
                  data-testid="issue-drill-on"
                  className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[15px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] text-dim">実技を行った人</span>
                <input
                  value={drillBy}
                  onChange={(e) => setDrillBy(e.target.value)}
                  placeholder="山田　太郎"
                  data-testid="issue-drill-by"
                  className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[15px]"
                />
              </label>
            </>
          )}
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-dim">
              {gate === "talk"
                ? "都合の悪い曜日や時間帯があれば（任意）"
                : "伝えておくことがあれば（任意）"}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={gate === "talk" ? "平日の夕方以降だと助かります" : ""}
              data-testid="issue-note"
              className="w-full rounded-lg border border-line bg-panel2 px-3.5 py-3 text-[14px]"
            />
          </label>
          <Btn
            tone="y"
            dis={busy}
            onClick={() => void post({ action: "request", note, drillOn, drillBy })}
            testid="issue-request"
          >
            {busy ? "…" : "発行申請を出す"}
          </Btn>
          <p className="text-[11.5px] leading-relaxed text-dim2">
            {gate === "talk"
              ? "出しても、その場では発行されません。こちらから討議の候補日をお送りします。"
              : "出しても、その場では発行されません。実技の記録を確かめてからご連絡します。"}
          </p>
        </div>
      )}

      {/* 日が決まった人。当日は討議の画面から入る */}
      {next === "talk" && (
        <a
          href={`/edu/${courseId}/talk`}
          data-testid="issue-go-talk"
          className="mt-3 block rounded-lg border border-line bg-panel2 px-3.5 py-3 text-center text-[13.5px] font-extrabold no-underline"
        >
          討議の画面へ
        </a>
      )}

      {ng && (
        <div className="mt-3 rounded-lg border border-red bg-ng-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ng-tx">
          {ng}
        </div>
      )}
    </section>
  );
}
