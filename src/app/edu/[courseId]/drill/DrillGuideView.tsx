"use client";

import { hoursText } from "@/content/courses";
import type { DrillGuide } from "@/content/drill";
import { Btn } from "@/components/ui/Btn";
import { RECORD_CSS, recordSheetHtml } from "@/lib/drillRecord";

/* 実技の手引きの中身。

   ── 印刷 ──
   現場に持って行くのは紙。実施記録の様式は、
   この画面ごと印刷して使う（print: で画面の飾りを消す）。

   ── 様式そのものは、ここには書かない ──
   同じ紙が、この画面と、ダウンロード（/api/drill-record）の2か所に出る。
   **2か所に書くと、必ず片方だけ直す日が来る。**
   紙は src/lib/drillRecord.ts で1回だけ組み立てて、両方がそれを使う。 */

function bold(t: string) {
  return t.split(/\*\*(.+?)\*\*/g).map((s, i) =>
    i % 2 ? <strong key={i} className="text-txt">{s}</strong> : <span key={i}>{s}</span>,
  );
}

export function DrillGuideView({
  course,
  guide,
}: {
  course: { id: string; name: string; basis: string; totalMin: number };
  guide: DrillGuide;
}) {
  const byScope = guide.scope.map((sc) => ({
    scope: sc,
    steps: guide.steps.filter((s) => s.scope === sc),
  }));
  return (
    <div className="px-5" data-testid="drill-guide">
      <h1 className="mt-4 text-[20px] font-black leading-snug">実技の手引き</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-dim">{course.name}／{course.basis}</p>

      {/* いちばん先に、これが何であって何でないかを言う */}
      <section className="mt-4 rounded-xl border border-cyan bg-panel p-4" data-testid="drill-what">
        <div className="text-[11px] tracking-[2px] text-cyan">これは何か</div>
        <p className="mt-1 text-[13px] leading-relaxed">
          この講座は、学科{hoursText(course.totalMin)}のあとに<strong className="text-txt">実技{hoursText(guide.legalMin)}</strong>があります。
          実技は実機が要るので、この仕組みではできません。
          <strong className="text-txt">事業者が自社で行います。</strong>
        </p>
        <p className="mt-2 text-[13px] leading-relaxed">
          告示で決まっているのは、科目「{guide.subject}」の範囲
          {guide.scope.map((s) => `「${s}」`).join("")}と、
          <strong className="text-txt">あわせて{hoursText(guide.legalMin)}</strong>ということだけです。
          下の割り振りは<strong className="text-txt">うちの案</strong>で、告示ではありません。
          会社の機械と現場に合わせて入れ替えて構いません。
          <strong className="text-txt">合計{hoursText(guide.legalMin)}を下回らないこと</strong>だけ守ってください。
        </p>
      </section>

      {/* 誰がやるか */}
      <section className="mt-4" data-testid="drill-teacher">
        <h2 className="text-[15px] font-extrabold">誰が行うか</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-dim">{bold(guide.teacher.rule)}</p>
        <ul className="mt-2 grid gap-1 text-[13px] leading-relaxed">
          {guide.teacher.who.map((w) => (
            <li key={w} className="flex gap-2"><span className="text-grn">○</span><span>{bold(w)}</span></li>
          ))}
        </ul>
        <div className="mt-2 text-[11.5px] text-dim2">実技にならないもの</div>
        <ul className="mt-1 grid gap-1 text-[13px] leading-relaxed text-dim">
          {guide.teacher.not.map((w) => (
            <li key={w} className="flex gap-2"><span className="text-red">×</span><span>{bold(w)}</span></li>
          ))}
        </ul>
      </section>

      {/* 用意するもの */}
      <section className="mt-4" data-testid="drill-prep">
        <h2 className="text-[15px] font-extrabold">当日までに用意するもの</h2>
        <ul className="mt-2 grid gap-1 text-[13px] leading-relaxed">
          {guide.prep.map((w) => (
            <li key={w} className="flex gap-2"><span className="text-dim2">□</span><span>{bold(w)}</span></li>
          ))}
        </ul>
      </section>

      {/* 3時間の割り振り */}
      <section className="mt-5" data-testid="drill-steps">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-extrabold">{hoursText(guide.legalMin)}の割り振り（案）</h2>
          <span className="ml-auto text-[11px] text-dim">計 {guide.totalMin}分</span>
        </div>
        {byScope.map((g) => (
          <div key={g.scope} className="mt-3">
            <div className="mb-1 text-[11.5px] font-bold text-yel">
              範囲「{g.scope}」（{g.steps.reduce((n, s) => n + s.min, 0)}分）
            </div>
            <div className="grid gap-2">
              {g.steps.map((s) => (
                <div key={s.no} className="rounded-lg border border-line bg-panel p-3" data-testid="drill-step">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[12px] text-yel">{s.no}</span>
                    <span className="text-[14px] font-extrabold">{s.title}</span>
                    <span className="ml-auto shrink-0 text-[12px] text-dim">{s.min}分</span>
                  </div>
                  <ul className="mt-2 grid gap-1 text-[12.5px] leading-relaxed text-dim">
                    {s.items.map((it) => (
                      <li key={it} className="flex gap-2"><span className="text-dim2">・</span><span>{bold(it)}</span></li>
                    ))}
                  </ul>
                  <div className="mt-2 text-[11px] text-dim2">学科の {s.gakka.join("・")} と結びつける</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 記録の残し方 */}
      <section className="mt-5" data-testid="drill-record-how">
        <h2 className="text-[15px] font-extrabold">記録の残し方</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-dim">
          特別教育を行ったら、受講者・科目などの記録を作って
          <strong className="text-txt">{guide.keepYears}年間保存</strong>します（労働安全衛生規則第38条）。
          学科の記録はこちらのデータベースに残りますが、<strong className="text-txt">実技の記録は会社が作って残します。</strong>
          下の様式を印刷して、実技の当日に記入し、会社で保管してください。
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          実技が済んだら、<strong className="text-txt">書き終えたこの様式を撮影（またはPDFに）して、
          受講者本人が修了証の画面から発行申請に添えて</strong>送ります。
          <strong className="text-txt">本部が中身を確かめてから、修了証が出せるようになります。</strong>
          記録が添えられていない申請は、通せません。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          {/* 実技をやるのは会社の人で、その人はうちの画面を開いたままにしておかない。
              手元に落として、人数分を何度でも印刷できるようにする */}
          <a
            href={`/api/drill-record?courseId=${course.id}`}
            download
            data-testid="drill-download"
            className="rounded-lg border border-yel px-4 py-2.5 text-[13px] font-extrabold text-yel no-underline"
          >
            様式をダウンロードする
          </a>
          <Btn tone="y" onClick={() => window.print()} testid="drill-print">この画面ごと印刷する</Btn>
        </div>
      </section>

      {/* 実施記録の様式。src/lib/drillRecord.ts が組み立てたものを、そのまま出す。
          ダウンロードで渡すのと**同じ紙**。中身はうちの定数だけで、
          受け取った文字は入らない（組み立てるときに escape してある） */}
      <style>{RECORD_CSS}</style>
      <section
        className="mt-5 overflow-hidden rounded-xl border border-line print:rounded-none print:border-0"
        data-testid="drill-form"
        dangerouslySetInnerHTML={{
          __html: recordSheetHtml({ id: course.id, name: course.name, basis: course.basis }, guide),
        }}
      />
    </div>
  );
}
