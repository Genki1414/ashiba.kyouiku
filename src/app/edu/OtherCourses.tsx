"use client";

import { useMemo, useState } from "react";
import {
  TOKUBETSU,
  hasJitsugi,
  isReady,
  searchTokubetsu,
  totalMinOf,
  type Tokubetsu,
} from "@/content/tokubetsu";
import { hoursText } from "@/content/courses";

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
   ・64件ある。探せないと、有るのに無いと思われる（下の検索）

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
        <span className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-dim2">
          準備中
        </span>
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

export function OtherCourses() {
  const [q, setQ] = useState("");
  const [gakkaOnly, setGakkaOnly] = useState(false);

  /* もう受けられるものは、上の札にすでに出ている。ここには出さない */
  const todo = useMemo(() => TOKUBETSU.filter((t) => !isReady(t)), []);
  const list = useMemo(() => {
    const base = gakkaOnly ? todo.filter((t) => !hasJitsugi(t)) : todo;
    return searchTokubetsu(q, base);
  }, [q, gakkaOnly, todo]);

  const nGakka = todo.filter((t) => !hasJitsugi(t)).length;

  return (
    <div data-testid="other-courses">
      <p className="text-[11.5px] leading-relaxed text-dim">
        法令で特別教育が要る業務です。
        <strong className="text-txt">まだ作っていないものも並べています。</strong>
        <br />
        入り用のものがあれば、
        <a href="/legal/tokushoho" className="text-yel underline">
          お問い合わせ先
        </a>
        までご連絡ください。作る順を決める材料にします。
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        /* 検索の入口。type="search" にすると、端末が消す×を出してくれる */
        type="search"
        inputMode="search"
        placeholder="探す（例：石綿、アスベスト、酸欠、ユンボ）"
        className="mt-2.5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[13.5px] text-txt"
        data-testid="other-search"
        aria-label="特別教育を探す"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setGakkaOnly((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] ${
            gakkaOnly ? "border-yel bg-[#1A1F14] text-yel" : "border-line text-dim2"
          }`}
          data-testid="other-gakka"
        >
          学科だけのもの（{nGakka}）
        </button>
        <span className="text-[11.5px] text-dim2" data-testid="other-count">
          {list.length}件
        </span>
      </div>

      {list.length ? (
        <div className="mt-1">
          {list.map((t) => (
            <Row key={t.slug} t={t} />
          ))}
        </div>
      ) : (
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
