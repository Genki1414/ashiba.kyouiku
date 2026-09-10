"use client";

import { useState } from "react";
import { emailLabel } from "@/lib/lineEmail";
import { Btn } from "@/components/ui/Btn";
import { Bar } from "@/components/ui/Bar";
import { dur, hm } from "@/components/ui/format";
import { CHAPTERS } from "@/training/chapters";
import { BRAND } from "@/content/brand";
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
  onIssue: (enrollmentId: string, courseName: string) => void;
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
        <div className="mt-1 text-[11.5px] text-grn">全単元を修了しています</div>
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
          <Btn tone="y" testid="admin-issue" dis={busy} onClick={() => onIssue(c.enrollmentId!, c.name)}>
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
  canDropAdmin,
  onConfirm,
  assign,
}: {
  r: PersonRow;
  busy: boolean;
  onIssue: (enrollmentId: string, courseName: string) => void;
  onRevoke: (enrollmentId: string, courseName: string) => void;
  onMember: () => void;
  onRole: () => void;
  /** この会社の教育担当者が、この人のほかにも居るか。

      **1人しか居ないときは外せない。**外すと、その会社は
      誰も名簿を開けなくなる（げんきさん 2026-09-09）。
      サーバも同じことを断るが、押せてしまうと
      「押したのに断られた」になるので、はじめから押させない */
  canDropAdmin: boolean;
  /** よそで取った資格。現物を見たら確認済みにする */
  onConfirm: (heldId: string, on: boolean, qualName: string) => void;
  /** この人に配れる受講コード（0028）。残数のある講座のうち、
      その人がまだ持っていないものだけが入る。1つも無ければ null */
  assign: {
    courses: { id: string; short: string; free: number }[];
    run: (courseId: string) => void;
  } | null;
}) {
  /* はじめは畳んでおく。ただし修了証を出せる人だけ「受講中」を開いておく。
     担当者がやることは、開かないと見つからないと意味がない */
  const [tab, setTab] = useState<Tab | null>(r.canIssue ? "doing" : null);
  /* 配る受講コードの講座。残数のある講座が2つ以上あるときだけ使う */
  const [pick, setPick] = useState("");

  const played = r.training.filter((t) => t.times > 0);
  /* 練習（チュートリアル）だけ通した人。点は付かないが、
     「まだ」と出すと一度も触っていない人と同じに見える */
  const tried = r.training.filter((t) => t.tried > 0);
  /* 通し見学を見ただけの人。手順を最後まで見たかは、
     点が付く前の段階として担当者が知りたい */
  const seen = r.training.filter((t) => t.seen > 0);
  const chapters = r.training.filter((t) => t.passed).length;

  /* 実務トレーニングは足場屋革命だけの売り物。
     売っていない店で並べると、担当者に「まだ」とだけ出る札が増える。
     売っていないものの成績を見せられても、担当者にできることが無い
     （2026-09-08） */
  type Chip = { k: Tab; t: string; v: string; on: boolean; mark: boolean };
  const chips: Chip[] = ([
    {
      k: "training",
      t: "実務トレーニング",
      v: played.length
        ? `${chapters} / ${r.training.length} 章`
        : tried.length
          ? "練習のみ"
          : seen.length
            ? "見学のみ"
            : "まだ",
      on: !!(played.length || tried.length || seen.length),
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
  ] as Chip[]).filter((c) => BRAND.training || c.k !== "training");

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
      {r.email && <div className="mt-0.5 truncate text-[11px] text-dim2">{emailLabel(r.email)}</div>}

      {/* 札は押した1つだけ開く */}
      {/* 札の数だけ横に並べる。決め打ちで3にすると、
          実務トレーニングを売っていない店で1枠空く */}
      <div
        className={`mt-3 grid gap-1.5 ${chips.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
        data-testid="admin-tabs"
      >
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

      {/* ── 実務トレーニング ── 売っている店だけ */}
      {BRAND.training && tab === "training" && (
        <div className="mt-2 rounded-lg border border-line bg-bg p-3" data-testid="admin-training">
          {!played.length && !tried.length && !seen.length ? (
            <div className="text-[12px] text-dim2">まだ受講を開始していません。</div>
          ) : (
            <div className="grid gap-1.5">
              {r.training.map((t) => {
                const c = CHAPTERS.find((x) => x.id === t.ch)!;
                return (
                  <div key={t.ch} className="flex items-baseline gap-2 text-[12.5px]">
                    <span className="shrink-0 text-dim">第{c.n}章</span>
                    <span className="min-w-0 flex-1 truncate text-dim2">{c.t}</span>
                    {/* 通し見学。最後まで見たか、途中までかを分ける */}
                    <span
                      className={`w-14 shrink-0 text-right text-[11px] ${
                        t.seenDone ? "text-cyan" : "text-dim2"
                      }`}
                      data-testid="admin-seen"
                    >
                      {t.seenDone ? "見学済" : t.seen ? "見学途中" : ""}
                    </span>
                    <span className={`shrink-0 font-bold ${t.passed ? "text-grn" : "text-dim"}`}>
                      {t.best === null ? "—" : `${t.best}点`}
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] text-dim2">
                      {t.times ? `${t.times}回` : t.tried ? `練習${t.tried}回` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-[10.5px] leading-relaxed text-dim2">
            「見学済」は通し見学を最後まで見たということです。点は本番の最高点で、
            練習（チュートリアル）は親方に聞けて目印も濃いので、点には入れず回数だけ出します。
            実務トレーニングは修了証の要件ではありません。
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
                      onClick={() => onRevoke(c.enrollmentId!, c.name)}
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
                {h.kind}（外部で取得・自己申告）
                {h.issuer ? `　${h.issuer}` : ""}
                {h.gotOn ? `　${day(h.gotOn)} 取得` : ""}
                {h.certNo ? <><br />修了証番号 {h.certNo}</> : null}
              </div>
              <button
                onClick={() => onConfirm(h.id, !h.confirmedAt, h.name)}
                disabled={busy}
                className={`mt-2 w-full rounded-lg border p-1.5 text-[11px] ${
                  h.confirmedAt ? "border-line text-dim2" : "border-yel text-yel"
                }`}
                data-testid="admin-held-confirm"
              >
                {h.confirmedAt ? "確認を取り消す" : "現物を確認した（確認済みにする）"}
              </button>
            </div>
          ))}

          {!!r.held.length && (
            <div className="text-[10.5px] leading-relaxed text-dim2">
              「外部で取得」は、ご本人がマイページから登録したものです。当社の記録ではありません。
              同じ特別教育を再受講させる必要はありませんが、
              業務に就かせる前に修了証の現物をご確認ください。
            </div>
          )}
        </div>
      )}

      {/* **いま見ている講座の席を、この人に直接配る（0028）。**

          受けさせる人が決まっているなら、受講コードの12文字を
          口頭やLINEで伝えて打たせる意味は無い。打ち間違えれば
          「開かない」と言われて、担当者がもう一度調べることになる。
          押せば、その人の画面にこの講座が出る。

          **受講コードの方式は残してある。**その場に居ない人、
          まだ名簿に入っていない人には、コードを渡すしかない。
          出すのは、在籍していて・まだ持っていなくて・席が余っているときだけ */}
      {assign && (assign.courses.length === 1 ? (
        <button
          className="mt-3 w-full rounded-lg border border-grn p-2 text-[11.5px] font-extrabold text-grn disabled:opacity-50"
          data-testid="admin-assign-row"
          disabled={busy}
          onClick={() => assign.run(assign.courses[0].id)}
        >
          {busy ? "配っています…" : `${assign.courses[0].short}の受講コードを配る（コード入力なし）`}
        </button>
      ) : (
        /* 残数のある講座が2つ以上あるときは、どれを配るかを選ぶ。
           前は画面の上で「いま見ている講座」を選ばせていたが、
           選んでも名簿は変わらないので、何が起きたのか分からなかった
           （げんきさん 2026-09-09） */
        <div className="mt-3 flex gap-2" data-testid="admin-assign-row">
          <select
            value={pick || assign.courses[0].id}
            onChange={(e) => setPick(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-2 text-[12px] text-txt"
            data-testid="admin-assign-course"
            aria-label="配る受講コードの講座"
          >
            {assign.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.short}（残り{c.free}）</option>
            ))}
          </select>
          <button
            className="shrink-0 rounded-lg border border-grn px-3 py-2 text-[11.5px] font-extrabold text-grn disabled:opacity-50"
            disabled={busy}
            onClick={() => assign.run(pick || assign.courses[0].id)}
            data-testid="admin-assign-go"
          >
            {busy ? "配っています…" : "受講コードを配る"}
          </button>
        </div>
      ))}

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
          ? "この申し込みを承認する（名簿に追加）"
          : "退職として登録（名簿から外れます。記録は残ります）"}
      </button>

      {/* 教育担当者の付け外し。**1人しか居ないときは外せない。**
          外すと、その会社は誰も名簿を開けなくなる */}
      {r.admin && !canDropAdmin ? (
        <div
          className="mt-2 w-full rounded-lg border border-line p-1.5 text-center text-[11px] leading-relaxed text-dim2"
          data-testid="admin-role-last"
        >
          この会社で唯一の教育担当者です
          <br />
          <span className="text-dim">外すには、先にもう1人決めてください</span>
        </div>
      ) : (
        <button
          className="mt-2 w-full rounded-lg border border-line p-1.5 text-[11px] text-dim2"
          data-testid="admin-role"
          onClick={onRole}
        >
          {r.admin ? "教育担当者から外す" : "この方を教育担当者にする"}
        </button>
      )}
    </div>
  );
}
