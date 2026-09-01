"use client";

import { useState } from "react";
import {
  LISTED_ON,
  TOKUBETSU,
  hasJitsugi,
  isBuilding,
  isReady,
  sourceOf,
  toCsv,
  toRows,
  totalMinOf,
  trustedHours,
  type Tokubetsu,
} from "@/content/tokubetsu";
import { hoursText } from "@/content/courses";

/* 特別教育の目録（法令で定められている65種類）。本部だけが見る。

   ── 何のために出すか ──
   次にどれを作るかを決めるため。売れる順でも、作りやすい順でもなく、
   **まず全部が見えていること**が要る。見えていないものは選べない。

   ── 出すときに気を付けたこと ──
   確かめていない行の時間を、確かめた行と同じ顔で並べない。
   元にした一覧は65件中11件しか条番号が無く、実際に1件間違っていた
   （第1種酸素欠乏＝4時間とあったが、正しくは5時間30分）。
   **4時間で修了証を出せば、法定時間に足りない紙になる。**
   だから「確かめた」印を出して、無い行は薄く出す。 */

type Filter = "all" | "ready" | "gakka" | "checked";

const FILTERS: { k: Filter; t: string; d: string }[] = [
  { k: "all", t: "ぜんぶ", d: "法令で定められている65種類" },
  { k: "ready", t: "作ってある", d: "いま受けられるもの" },
  { k: "gakka", t: "学科だけ", d: "実技が要らない＝この仕組みだけで修了できる" },
  { k: "checked", t: "確かめた", d: "条文か実物で時間を確かめた行" },
];

function pick(f: Filter): Tokubetsu[] {
  if (f === "ready") return TOKUBETSU.filter(isReady);
  if (f === "gakka") return TOKUBETSU.filter((t) => !hasJitsugi(t));
  if (f === "checked") return TOKUBETSU.filter(trustedHours);
  return TOKUBETSU;
}

function Row({ t }: { t: Tokubetsu }) {
  const s = sourceOf(t);
  return (
    <div className="border-t border-line py-2.5" data-testid="catalog-row">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[11px] text-dim2">{t.no}</span>
        <span className={`min-w-0 text-[13px] font-bold ${isReady(t) ? "text-yel" : "text-txt"}`}>
          {t.name}
        </span>
      </div>
      <div className="mt-1 pl-5 text-[11.5px] leading-relaxed text-dim">
        学科 {hoursText(t.gakkaMin)}
        {hasJitsugi(t) && `／実技 ${hoursText(t.jitsugiMin)}`}
        <span className="text-dim2">　計 {hoursText(totalMinOf(t))}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 pl-5 text-[11px] text-dim2">
        <span>{t.basis}</span>
        {t.from && <span>（{t.from} 施行）</span>}
        {/* 裏取りの記録。次に開いた人が、条文を調べ直さなくて済む */}
        {t.doc && <span className="text-dim">{t.doc}</span>}
        {s.url && (
          <a href={s.url} target="_blank" rel="noreferrer" className="text-dim underline">
            出典
          </a>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5 pl-5">
        {isReady(t) && (
          <span className="rounded border border-yel px-1.5 py-0.5 text-[10.5px] text-yel">
            作ってある
          </span>
        )}
        {isBuilding(t) && (
          <span className="rounded border border-yel px-1.5 py-0.5 text-[10.5px] text-yel">
            いま作っています
          </span>
        )}
        {!hasJitsugi(t) && (
          <span className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-dim">
            学科だけ
          </span>
        )}
        {/* 確かめていない行の時間は、目録として写しただけ。
            そのまま講座にすると、法定時間に足りない紙が出る */}
        {trustedHours(t) ? (
          <span className="rounded border border-grn px-1.5 py-0.5 text-[10.5px] text-grn">
            時間を確かめた
          </span>
        ) : (
          <span className="rounded border border-org px-1.5 py-0.5 text-[10.5px] text-org">
            時間は未確認
          </span>
        )}
      </div>
    </div>
  );
}

/* 持ち出し。この目録は、いずれ単体で事業にする。
   **画面から手で写すのでは、写し間違いが入る。**

   端末によっては clipboard が使えない（古い端末、http、権限）。
   そのときは黙って何も起きないのではなく、
   /api/tokubetsu を開いてもらう案内を出す。 */
function Copy() {
  const [said, setSaid] = useState("");

  const copy = async (what: "csv" | "json") => {
    const text = what === "csv" ? toCsv() : JSON.stringify(toRows(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setSaid(`${what.toUpperCase()} をコピーしました（${toRows().length}件）`);
    } catch {
      setSaid("この端末ではコピーできません。下の「開く」から取ってください。");
    }
    setTimeout(() => setSaid(""), 4000);
  };

  return (
    <div className="mt-3 rounded-lg border border-line bg-bg p-3">
      <div className="text-[11px] tracking-[2px] text-dim2">持ち出す</div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-dim">
        単体で事業にするときに、丸ごと移せるようにしてあります。
        <strong className="text-txt">確かめたかどうかの印も一緒に出ます。</strong>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => void copy("csv")}
          className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-dim"
          data-testid="catalog-copy-csv"
        >
          CSV をコピー
        </button>
        <button
          onClick={() => void copy("json")}
          className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-dim"
          data-testid="catalog-copy-json"
        >
          JSON をコピー
        </button>
        <a
          href="/api/tokubetsu?format=csv"
          className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-dim no-underline"
          data-testid="catalog-open-csv"
        >
          CSV を開く
        </a>
        <a
          href="/api/tokubetsu"
          className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-dim no-underline"
          data-testid="catalog-open-json"
        >
          JSON を開く
        </a>
      </div>
      {said && (
        <div className="mt-2 text-[11.5px] text-grn" data-testid="catalog-copied">
          {said}
        </div>
      )}
    </div>
  );
}

export function CatalogClient() {
  const [f, setF] = useState<Filter>("all");
  const list = pick(f);
  const nReady = TOKUBETSU.filter(isReady).length;
  const nGakka = TOKUBETSU.filter((t) => !hasJitsugi(t)).length;
  const nChecked = TOKUBETSU.filter(trustedHours).length;

  return (
    <div className="mt-4" data-testid="catalog">
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="text-[11px] tracking-[2px] text-dim">特別教育の目録</div>
        <div className="mt-1 text-[13px] leading-relaxed text-dim">
          法令で特別教育が要る業務は <strong className="text-txt">{TOKUBETSU.length}種類</strong>。
          そのうち作ってあるのが {nReady}種類、
          <strong className="text-txt">実技が要らないものが {nGakka}種類</strong>です。
          <br />
          実技の要らないものは、この仕組みだけで修了まで出せます。
        </div>
        {/* 時間は目録として写しただけ。ここを飛ばすと、足りない紙が出る */}
        <div className="mt-2 rounded-lg border border-org bg-bg p-3 text-[11.5px] leading-relaxed text-dim">
          <strong className="text-org">時間を確かめてあるのは {nChecked}種類だけです。</strong>
          <br />
          残りは一覧を写したもので、実際に1件まちがっていました
          （第1種酸素欠乏が4時間となっていましたが、正しくは5時間30分）。
          <strong className="text-txt">講座にするときは、必ず規程の条文から取り直してください。</strong>
        </div>
        <div className="mt-2 text-[11px] text-dim2">{LISTED_ON} 現在</div>
        <Copy />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <button
            key={x.k}
            onClick={() => setF(x.k)}
            className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${
              f === x.k ? "border-yel bg-[#1A1F14] text-yel" : "border-line text-dim2"
            }`}
            data-testid="catalog-filter"
          >
            {x.t}
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[11.5px] text-dim2">
        {FILTERS.find((x) => x.k === f)?.d}　（{list.length}種類）
      </div>

      <div className="mt-2 rounded-xl border border-line bg-panel px-4 pb-3">
        {list.map((t) => (
          <Row key={t.slug} t={t} />
        ))}
      </div>
    </div>
  );
}
