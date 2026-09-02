"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadProgress, type ProgressState } from "@/lib/progressClient";
import { canStart, loadPrep, type PrepState } from "@/lib/prep";
import { loadMe, readMe, type Me } from "@/lib/me";
import { Bar } from "@/components/ui/Bar";
import { hm } from "@/components/ui/format";
import { hoursText } from "@/content/courses";
import { TALK_MIN } from "@/content/shokucho";

type LessonRow = { id: string; title: string; legal_min: number; figures: number; cases: number; quiz: number };
type SubjectRow = { id: number; name: string; legal_min: number; lessons: LessonRow[] };

export function LessonList({
  course,
  subjects,
  live = false,
  drillMin = 0,
}: {
  course: { id: string; name: string; basis: string };
  subjects: SubjectRow[];
  /** 決まった日時に集まる回（討議）がある講座か。職長教育がこれ */
  live?: boolean;
  /** 学科のあとに残る実技の法定時間（分）。無ければ 0。
      高所作業車がこれ（3時間）。**ここを出さないと、
      6時間見終わってから「まだ修了ではない」と知ることになる。** */
  drillMin?: number;
}) {
  const [prog, setProg] = useState<Record<string, ProgressState>>({});
  const [prep, setPrep] = useState<PrepState | null>(null);
  /* 修了証に載る氏名と生年月日は、マイページで入れた1か所を見る。
     受講の準備が済んでいるかは、端末の側（同意・顔・書類）と
     人の側（氏名・生年月日）の両方がそろって はじめて「済み」 */
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    /* 準備は人ごとに分けて持っている。誰として使っているかを見てから読む */
    let alive = true;
    void loadPrep().then((p) => { if (alive) setPrep(p); });
    const kept = readMe();
    if (kept) setMe(kept);
    void loadMe().then((fresh) => { if (alive && fresh) setMe(fresh); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = subjects.flatMap((s) => s.lessons.map((l) => l.id));
      const entries = await Promise.all(ids.map(async (id) => [id, await loadProgress(course.id, id)] as const));
      if (alive) setProg(Object.fromEntries(entries));
    })();
    return () => {
      alive = false;
    };
  }, [subjects, course.id]);

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
        <h1 className="mt-2 text-[18px] font-black leading-snug">{course.name}</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-dim">{course.basis}</p>
        {mode === "local" && (
          <p className="mt-2 inline-block rounded border border-org px-1.5 py-0.5 text-[11px] text-org">
            端末内記録（Supabase 未設定のため、視聴記録はこの端末にだけ保存されます）
          </p>
        )}
      </div>

      {prep && (
        <div className="mb-4 px-5">
          <Link
            href={`/edu/${course.id}/prep`}
            className={`block rounded-xl border bg-panel p-3.5 no-underline ${
              canStart(prep, me) ? (prep.skipped ? "border-org" : "border-grn") : "border-yel"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-txt">受講の準備（同意・本人確認）</span>
              <span
                className={`ml-auto rounded border px-1.5 py-0.5 text-[11px] ${
                  canStart(prep, me)
                    ? prep.skipped
                      ? "border-org text-org"
                      : "border-grn text-grn"
                    : "border-yel text-yel"
                }`}
              >
                {canStart(prep, me) ? (prep.skipped ? "記録は無効（見るだけ）" : "登録済み") : "未登録"}
              </span>
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-dim">
              {canStart(prep, me)
                ? prep.skipped
                  ? "カメラを使わない閲覧モードです。正式な受講にするにはタップして登録してください。"
                  : `受講者：${me?.name ?? ""}。受講中はカメラで本人確認を行います。`
                : me?.userId && (!me.name || !me.birth)
                  ? "修了証に載る氏名と生年月日が未登録です。マイページで一度入れれば、ほかの講座でもそのまま使われます。"
                  : "受講を始める前に、カメラの使用への同意と本人確認の登録が必要です。"}
            </div>
          </Link>
        </div>
      )}

      {/* 討議のある講座（職長教育）だけ。討議は講座に1回、45分。
          単元と違って日時が決まっているので、単元一覧の前に出す */}
      {live && (
        <div className="mb-4 px-5">
          <Link
            href={`/edu/${course.id}/talk`}
            data-testid="go-talk"
            className="block rounded-xl border border-cyan bg-panel p-3.5 no-underline"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-txt">討議（{hm(TALK_MIN * 60)}・オンライン）</span>
              <span className="ml-auto rounded border border-cyan px-1.5 py-0.5 text-[11px] text-cyan">
                日時が決まっています
              </span>
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-dim">
              この講座は討議方式が原則です。録画を見るだけでは討議になりません。
              決まった時間に集まって、講師と受講者でやり取りします。
            </div>
          </Link>
        </div>
      )}

      {/* 実技のある講座（高所作業車）だけ。**単元一覧の前に出す。**
          学科を見終わってから「まだ修了ではない」と知るのでは遅い。
          実技は実機が要るので、こちらではできない（事業者が自社で行う）。
          時間は講座から出す。ここに「3時間」と書くと次の講座で嘘になる */}
      {drillMin > 0 && (
        <div className="mb-4 px-5">
          <div
            className="rounded-xl border border-cyan bg-panel p-3.5"
            data-testid="drill-note"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-txt">実技（{hoursText(drillMin)}）</span>
              <span className="ml-auto rounded border border-cyan px-1.5 py-0.5 text-[11px] text-cyan">
                事業者で行います
              </span>
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-dim">
              この講座は、学科のあとに実技があります。実機が要るので、この画面ではできません。
              <br />
              <strong className="text-txt">学科だけでは修了になりません。</strong>
              実技を事業者で行ってから、修了証の画面で発行申請を出してください。
              そのとき、実技を行った日と行った人を入れていただきます。
            </div>
            {/* 何を何分やればいいかは、ここに書いてある。
                会社の人が見る画面なので、受講者から渡せるようにしておく */}
            <Link
              href={`/edu/${course.id}/drill`}
              data-testid="go-drill"
              className="mt-2 block rounded-lg border border-cyan px-3 py-2 text-center text-[12.5px] font-bold text-cyan no-underline"
            >
              実技の手引き（会社の人に渡すもの）
            </Link>
          </div>
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
                  href={`/edu/${course.id}/${l.id}`}
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
            href={`/edu/${course.id}/exam`}
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

        {/* 修了証。試験に受かっていれば出せる。

            討議や実技が残る講座は、ここが「発行申請」の入口になる。
            全単元を見終わって申請を出すと、こちらが候補日を返す
            （src/components/edu/IssuePanel.tsx） */}
        <Link
          href={`/edu/${course.id}/cert`}
          data-testid="go-cert"
          className="mt-2 block rounded-lg border border-line p-3 text-center text-[12.5px] text-dim no-underline"
        >
          {live || drillMin > 0 ? "修了証と発行申請" : "修了証を見る"}
        </Link>
      </div>
    </main>
  );
}
