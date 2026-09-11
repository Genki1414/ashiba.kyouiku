"use client";

import { useMemo, useState } from "react";
import {
  TOKUBETSU,
  hasJitsugi,
  isBuilding,
  isReady,
  matches,
  norm,
  searchTokubetsu,
  tokubetsuOfCourse,
  totalMinOf,
  type Tokubetsu,
} from "@/content/tokubetsu";
import { hoursText, type CourseMeta } from "@/content/courses";
import { CourseCard, CourseSoon } from "./CourseCard";

/* 「その他特別教育」を開いたときに出る、法令で定められている特別教育の一覧。

   ── なぜ、まだ作っていないものまで出すか ──
   「うちは足場だけの会社」と思われて終わるのがいちばん困る。
   石綿も粉じんも酸欠も、同じ現場で要る。
   **並べておけば「これも要る」と気づいてもらえる。**

   ── 出すときに気を付けたこと ──
   ・**受けられるように見せない。** まだ作っていないものは
     「準備中」とはっきり出す。押しても中へ入れない
   ・**実技の要るものは、そう書く。** 実技は事業者が自社で行うもので、
     この仕組みだけでは修了しない。黙って並べると
     「ここで全部済む」と思われる
   ・**探す所は、いちばん上に置く。**71講座がここに並ぶので、
     下に置くと71枚めくらないと窓に届かない。そして
     **上に出した窓は、下にある講座も探せなければ意味がない**。
     だから受けられる講座・準備中の講座・目録の3つとも、この窓で絞る

   時間は目録の値。**確かめてある行はまだ少ない**（src/content/tokubetsu.ts）。
   受けられる講座になった時点で、条文から取り直した時間に入れ替わる。 */

function Row({ t }: { t: Tokubetsu }) {
  return (
    <div className="border-t border-line py-2.5" data-testid="other-row">
      <div className="text-[13px] font-bold leading-snug text-txt">{t.name}</div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-dim">
        学科 {hoursText(t.gakkaMin)}
        {hasJitsugi(t) && `／実技 ${hoursText(t.jitsugiMin)}`}
        <span className="text-dim2">　計 {hoursText(totalMinOf(t))}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {/* いま作っているものは、そう出す。
            「準備中」だけだと、いつになるか分からないものと同じに見える。
            待てるかどうかは、この差で決まる */}
        {isBuilding(t) ? (
          <span className="rounded border border-yel px-1.5 py-0.5 text-[10.5px] text-yel">
            いま作っています
          </span>
        ) : (
          <span className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-dim2">
            準備中
          </span>
        )}
        {hasJitsugi(t) ? (
          /* 実技は事業者が自社で行う。ここだけでは終わらないと先に言う */
          <span className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-dim2">
            実技は事業者で
          </span>
        ) : (
          <span className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-dim">
            学科だけで修了
          </span>
        )}
      </div>
    </div>
  );
}

/** 講座が、探している言葉に当たるか。

    講座には別名（アスベスト、ユンボ…）を持たせていないので、
    目録の行を見つけて、そちらの別名で当てにいく。
    見つからなければ、名前と根拠だけで当てる */
function matchesCourse(c: CourseMeta, q: string): boolean {
  const t = tokubetsuOfCourse(c.id);
  if (t) return matches(t, q);
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = norm(`${c.name} ${c.basis}`);
  return words.every((w) => hay.includes(w));
}

export function OtherCourses({
  ready = [],
  soon = [],
  main = [],
}: {
  /** 受けられる講座（menu: "other" のもの） */
  ready?: CourseMeta[];
  /** 準備中の講座（menu: "other" のもの） */
  soon?: CourseMeta[];
  /** 大きな札で上に出している講座（足場・職長）。
      **打ったときだけ**ここにも出す。空の窓では出さない（上に既に有る）。
      前は「足場」「職長」と打つと0件になっていた（docs/92 §4。2026-09-11） */
  main?: CourseMeta[];
}) {
  const [q, setQ] = useState("");
  const typed = norm(q).trim().length > 0;

  /* 目録のうち、まだ講座になっていないもの */
  const todo = useMemo(() => TOKUBETSU.filter((t) => !isReady(t)), []);

  const hitMain = useMemo(() => (typed ? main.filter((c) => matchesCourse(c, q)) : []), [main, q, typed]);
  const hitReady = useMemo(() => ready.filter((c) => matchesCourse(c, q)), [ready, q]);
  const hitSoon = useMemo(() => soon.filter((c) => matchesCourse(c, q)), [soon, q]);
  const hitTodo = useMemo(() => {
    const found = searchTokubetsu(q, todo);
    /* いま作っているものを先頭へ。**次に出るものが下に埋もれない**。
       ほかは目録のまま（法令の番号順） */
    return [...found.filter(isBuilding), ...found.filter((t) => !isBuilding(t))];
  }, [q, todo]);

  const nHit = hitMain.length + hitReady.length + hitSoon.length + hitTodo.length;

  return (
    <div data-testid="other-courses">
      {/* 探す所を、いちばん上に。ここが下にあると、71枚めくることになる */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        /* 検索の入口。type="search" にすると、端末が消す×を出してくれる */
        type="search"
        inputMode="search"
        placeholder="探す（例：石綿、アスベスト、酸欠、ユンボ）"
        className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px] text-txt"
        data-testid="other-search"
        aria-label="特別教育を探す"
      />

      {/* 絞り込みの札は置かない。**探す窓ひとつで足りる。**
          「学科だけのもの」は、受ける人が講座を選ぶときの入口にならなかった。
          実技が要るかどうかは、札を開けば書いてある */}
      <div className="mt-2 text-[11.5px] text-dim2" data-testid="other-count">
        {nHit}件
      </div>

      {/* 上の大きな札の講座は、打ったときだけここにも出す */}
      {!!hitMain.length && (
        <div className="mt-2.5 grid gap-2.5" data-testid="other-main-hit">
          {hitMain.map((c) => (
            <CourseCard key={c.id} c={c} />
          ))}
        </div>
      )}
      {/* 受けられるものが先。次に準備中。最後に、まだ講座にしていない目録 */}
      {!!hitReady.length && (
        <div className="mt-2.5 grid gap-2.5">
          {hitReady.map((c) => (
            <CourseCard key={c.id} c={c} />
          ))}
        </div>
      )}
      {!!hitSoon.length && (
        <div className="mt-2.5 grid gap-2.5">
          {hitSoon.map((c) => (
            <CourseSoon key={c.id} c={c} />
          ))}
        </div>
      )}
      {!!hitTodo.length && (
        <div className="mt-1">
          {hitTodo.map((t) => (
            <Row key={t.slug} t={t} />
          ))}
        </div>
      )}

      {!nHit && (
        /* 空で終わらせない。打ち方が悪かったのか、無いのかが分からない */
        <div className="mt-3 rounded-lg border border-line bg-bg p-3.5 text-[12px] leading-relaxed text-dim">
          「{q}」に当たるものがありませんでした。
          <br />
          法令の名前と違う呼び方でも探せます（石綿→アスベスト、酸素欠乏→酸欠）。
          見つからないときは、
          <a href="/legal/tokushoho" className="text-yel underline">
            お問い合わせ先
          </a>
          までご連絡ください。
        </div>
      )}
    </div>
  );
}
