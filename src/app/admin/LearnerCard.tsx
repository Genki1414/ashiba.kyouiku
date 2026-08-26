"use client";

import { useState } from "react";
import { Btn } from "@/components/ui/Btn";
import { Bar } from "@/components/ui/Bar";
import { dur, hm } from "@/components/ui/format";
import { CHAPTERS } from "@/training/chapters";
import type { CourseRow, PersonRow } from "@/training/roster";

/* 名簿の1人ぶん。

   特別教育はこれから増える。1人が2つも3つも持つようになるので、
   名前の下は3つに畳んでおく。

     実務トレーニング … 章ごとの点と回数
     受講中　　　　　 … いま受けている資格と、その進み具合
     取得済み資格　　 … 出した修了証の一覧

   全部いっぺんに広げると、10人並んだだけで画面が読めなくなる。
   押した1つだけ開く。担当者がやること（修了証を出す）が
   残っているときは、その札に印を付けて、閉じていても分かるようにする。 */

type Tab = "training" | "doing" | "done";

const day = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

/** 受講中の1つ。学科の進みと修了試験、出せるなら発行の押しどころ */
function Doing({
  c,
  busy,
  onIssue,
}: {
  c: CourseRow;
  busy: boolean;
  onIssue: (enrollmentId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-bg p-3" data-testid="admin-doing">
      <div className="text-[12.5px] font-black leading-snug">{c.name}</div>

      <div className="mt-2 flex items-baseline gap-2 text-[12.5px]">
        <span className="shrink-0 text-dim">学科</span>
        <span className={`font-bold ${c.lessonsPassed >= c.lessonsTotal ? "text-grn" : ""}`}>
          {c.lessonsPassed} / {c.lessonsTotal} 単元
        </span>
        <span className="ml-auto text-[11.5px] text-dim2">
          {Math.round((c.lessonsPassed / Math.max(1, c.lessonsTotal)) * 100)}%
        </span>
      </div>
      <div className="mt-1.5">
        <Bar
          v={c.lessonsPassed}
          max={c.lessonsTotal}
          color={c.lessonsPassed >= c.lessonsTotal ? "var(--color-grn)" : undefined}
        />
      </div>
      <div className="mt-1.5 flex items-baseline gap-2 text-[11.5px]">
        <span className="shrink-0 text-dim2">見た時間</span>
        <span className={c.watchedSec >= c.requiredSec ? "text-grn" : "text-dim"}>
          {dur(c.watchedSec)}
        </span>
        <span className="text-dim2">／ 法定 {dur(c.requiredSec)}</span>
      </div>
      {c.now ? (
        <div className="mt-1 text-[11.5px] leading-relaxed text-dim2">
          {c.now.watchedSec > 0 ? "いま" : "次は"} {c.now.id}　{c.now.title}
          {c.now.watchedSec > 0 && (
            <span className="text-dim">（{hm(c.now.watchedSec)} / {c.now.needSec / 60}分）</span>
          )}
        </div>
      ) : (
        <div className="mt-1 text-[11.5px] text-grn">全単元を終えています</div>
      )}

      <div className="mt-2 flex items-baseline gap-2 text-[12.5px]">
        <span className="w-16 shrink-0 text-dim">修了試験</span>
        {c.exam ? (
          <span className={c.exam.passed ? "font-bold text-grn" : "text-red"}>
            {c.exam.score} / {c.exam.total}　{c.exam.passed ? "合格" : "不合格"}
          </span>
        ) : (
          <span className="text-dim2">まだ</span>
        )}
      </div>

      <div className="mt-2.5 border-t border-line pt-2.5">
        {c.canIssue && c.enrollmentId ? (
          <Btn tone="y" testid="admin-issue" dis={busy} onClick={() => onIssue(c.enrollmentId!)}>
            {busy ? "発行しています…" : "修了証を発行する"}
          </Btn>
        ) : (
          <div className="text-[11.5px] leading-relaxed text-dim2">
            修了証はまだ出せません（全単元と修了試験の合格が要ります）
          </div>
        )}
      </div>
    </div>
  );
}

export function LearnerCard({
  r,
  busy,
  onIssue,
  onRevoke,
  onMember,
  onRole,
  onConfirm,
}: {
  r: PersonRow;
  busy: boolean;
  onIssue: (enrollmentId: string) => void;
  onRevoke: (enrollmentId: string) => void;
  onMember: () => void;
  onRole: () => void;
  /** よそで取った資格。現物を見たら確認済みにする */
  onConfirm: (heldId: string, on: boolean) => void;
}) {
  /* はじめは畳んでおく。ただし修了証を出せる人だけ「受講中」を開いておく。
     担当者がやることは、開かないと見つからないと意味がない */
  const [tab, setTab] = useState<Tab | null>(r.canIssue ? "doing" : null);

  const played = r.training.filter((t) => t.times > 0);
  const chapters = r.training.filter((t) => t.passed).length;

  const chips: { k: Tab; t: string; v: string; on: boolean; mark: boolean }[] = [
    {
      k: "training",
      t: "実務トレーニング",
      v: played.length ? `${chapters} / ${r.training.length} 章` : "まだ",
      on: !!played.length,
      mark: false,
    },
    {
      k: "doing",
      t: "受講中",
      v: r.doing.length ? `${r.doing.length} 件` : "なし",
      on: !!r.doing.length,
      mark: r.canIssue,
    },
    {
      k: "done",
      t: "取得済み資格",
      /* よそで取ったものも数える。担当者が見たいのは
         「この人を現場に出せるか」で、出どころは関係ない */
      v: r.done.length + r.held.length ? `${r.done.length + r.held.length} 件` : "なし",
      on: !!(r.done.length + r.held.length),
      mark: false,
    },
  ];

  return (
    <div className="rounded-xl border border-line bg-panel p-4" data-testid="admin-row">
      <div className="flex items-baseline gap-2">
        <div className="min-w-0 flex-1 truncate text-[15px] font-black">{r.name}</div>
        {/* まだ許可していない人。上の「参加の申し込み」と同じ人。
            退職と出すと、入ったことのない人が辞めたように見える */}
        {r.pending && (
          <span
            className="rounded border border-yel px-1.5 py-0.5 text-[10px] text-yel"
            data-testid="admin-pending"
          >
            申し込み中
          </span>
        )}
        {r.admin && (
          <span className="rounded border border-cyan px-1.5 py-0.5 text-[10px] text-cyan">担当者</span>
        )}
      </div>
      {r.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{r.email}</div>}

      {/* 3つの札。押した1つだけ開く */}
      <div className="mt-3 grid grid-cols-3 gap-1.5" data-testid="admin-tabs">
        {chips.map((c) => (
          <button
            key={c.k}
            onClick={() => setTab((v) => (v === c.k ? null : c.k))}
            className={`rounded-lg border px-1.5 py-2 text-center ${
              tab === c.k
                ? "border-yel bg-[#1A1F14]"
                : c.mark
                  ? "border-yel"
                  : c.on
                    ? "border-line bg-bg"
                    : "border-line"
            }`}
            data-testid="admin-tab"
          >
            <div className={`text-[10px] leading-tight ${tab === c.k ? "text-yel" : "text-dim"}`}>
              {c.t}
            </div>
            <div
              className={`mt-0.5 text-[12.5px] font-black ${
                c.mark ? "text-yel" : c.on ? "" : "text-dim2"
              }`}
            >
              {c.v}
            </div>
          </button>
        ))}
      </div>

      {r.canIssue && tab !== "doing" && (
        <div className="mt-1.5 text-[11px] text-yel" data-testid="admin-canissue">
          修了証を出せる資格があります（「受講中」を押してください）
        </div>
      )}

      {/* ── 実務トレーニング ── */}
      {tab === "training" && (
        <div className="mt-2 rounded-lg border border-line bg-bg p-3" data-testid="admin-training">
          {!played.length ? (
            <div className="text-[12px] text-dim2">まだ通していません。</div>
          ) : (
            <div className="grid gap-1.5">
              {r.training.map((t) => {
                const c = CHAPTERS.find((x) => x.id === t.ch)!;
                return (
                  <div key={t.ch} className="flex items-baseline gap-2 text-[12.5px]">
                    <span className="shrink-0 text-dim">第{c.n}章</span>
                    <span className="min-w-0 flex-1 truncate text-dim2">{c.t}</span>
                    <span className={`shrink-0 font-bold ${t.passed ? "text-grn" : "text-dim"}`}>
                      {t.best === null ? "—" : `${t.best}点`}
                    </span>
                    <span className="w-12 shrink-0 text-right text-[11px] text-dim2">
                      {t.times ? `${t.times}回` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-[10.5px] leading-relaxed text-dim2">
            点は本番の最高点です（練習は数えません）。実務トレーニングは修了証の要件ではありません。
          </div>
        </div>
      )}

      {/* ── 受講中 ── */}
      {tab === "doing" && (
        <div className="mt-2 grid gap-2" data-testid="admin-doings">
          {!r.doing.length ? (
            <div className="rounded-lg border border-line bg-bg p-3 text-[12px] leading-relaxed text-dim2">
              いま受けている特別教育はありません。
              受講コードを渡すと、その人の学科が開きます。
            </div>
          ) : (
            r.doing.map((c) => (
              <Doing key={c.courseId} c={c} busy={busy} onIssue={onIssue} />
            ))
          )}
        </div>
      )}

      {/* ── 取得済み資格 ── */}
      {tab === "done" && (
        <div className="mt-2 grid gap-2" data-testid="admin-dones">
          {!r.done.length && !r.held.length ? (
            <div className="rounded-lg border border-line bg-bg p-3 text-[12px] text-dim2">
              まだ資格がありません。
            </div>
          ) : (
            r.done.map((c) => (
              <div
                key={c.courseId}
                className="rounded-lg border border-line bg-bg p-3"
                data-testid="admin-done"
              >
                <div className="text-[12.5px] font-black leading-snug">{c.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-mono text-[12.5px] text-grn">証明番号 {c.cert?.no}</span>
                  <span className="text-[11.5px] text-dim">{day(c.cert?.at ?? null)} 発行</span>
                  {c.enrollmentId && (
                    <button
                      className="ml-auto rounded-lg border border-line px-2.5 py-1 text-[11px] text-dim"
                      data-testid="admin-revoke"
                      onClick={() => onRevoke(c.enrollmentId!)}
                    >
                      取り消す
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* よそで取った資格。本人がマイページから入れたもの。
              自己申告のままでは、事業者が確かめたことにならない。
              紙を見たら確認済みにする */}
          {r.held.map((h) => (
            <div
              key={h.id}
              className={`rounded-lg border bg-bg p-3 ${h.confirmedAt ? "border-line" : "border-yel"}`}
              data-testid="admin-held"
            >
              <div className="flex items-baseline gap-2">
                <div className="min-w-0 flex-1 text-[12.5px] font-black leading-snug">{h.name}</div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                    h.confirmedAt ? "border-grn text-grn" : "border-yel text-yel"
                  }`}
                >
                  {h.confirmedAt ? "確認済み" : "確認待ち"}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-dim2">
                {h.kind}（よそで取得）
                {h.issuer ? `　${h.issuer}` : ""}
                {h.gotOn ? `　${day(h.gotOn)} 取得` : ""}
                {h.certNo ? <><br />修了証番号 {h.certNo}</> : null}
              </div>
              <button
                onClick={() => onConfirm(h.id, !h.confirmedAt)}
                disabled={busy}
                className={`mt-2 w-full rounded-lg border p-1.5 text-[11px] ${
                  h.confirmedAt ? "border-line text-dim2" : "border-yel text-yel"
                }`}
                data-testid="admin-held-confirm"
              >
                {h.confirmedAt ? "確認を取り消す" : "修了証の現物を見た（確認済みにする）"}
              </button>
            </div>
          ))}

          {!!r.held.length && (
            <div className="text-[10.5px] leading-relaxed text-dim2">
              「よそで取得」は本人がマイページから入れたものです。この仕組みの記録ではありません。
              同じ特別教育を受け直させる必要はありませんが、
              就かせる前に修了証の現物を確かめてください。
            </div>
          )}
        </div>
      )}

      {/* 在籍の出し入れ。退職しても記録は消さない。
          申し込み中の人は、ここからも許可できる */}
      <button
        className={`mt-3 w-full rounded-lg border p-1.5 text-[11px] ${
          r.pending ? "border-yel text-yel" : "border-line text-dim2"
        }`}
        data-testid="admin-member"
        onClick={onMember}
      >
        {r.pending
          ? "この申し込みを許可する（名簿に入れる）"
          : "退職にする（名簿から外れます。記録は残ります）"}
      </button>

      <button
        className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11px] text-dim2"
        data-testid="admin-role"
        onClick={onRole}
      >
        {r.admin ? "担当者をやめてもらう" : "この人を教育担当者にする"}
      </button>
    </div>
  );
}
