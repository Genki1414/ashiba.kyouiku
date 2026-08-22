/* 第3章の通し見学。

   第2章と同じく、実際に判定（rules.ts）を通して盤面を進めます。
   判定を通る手順しか出てきません。

   「なぜそうするのか」だけは、ここに書いてあります。
   ── げんきさんの確認が要る文言です（docs/09-通し見学の文言.md） */

import { judge, type Action, type HiuchiPoint, type Scene } from "./rules";
import { initialState, type Ch3State } from "./state";
import {
  CORNERS,
  NEXT_TO_CORNER,
  POSTS,
  SHEET_SPANS,
  postName,
  tieOrder,
  type PostKey,
} from "./layout";

export type DemoStep = {
  n: number;
  t: string;
  why: string;
  state: Ch3State;
  /** 平面図で見せるか、立面（シート）で見せるか */
  view: "plan" | "sheet";
  /** この手で開く場面。見学でも、遊ぶときと同じように操作してもらう */
  scene?: Scene;
};

/** 火打の取付点。支柱どうし・別の面・出隅から同じ距離（＝二等辺三角形） */
const A: HiuchiPoint = { k: "post", f: "a", n: 1 };
const B: HiuchiPoint = { k: "post", f: "b", n: 1 };

/* 手順を、そのまま並べる。1手ごとに「何を」「なぜ」を持たせる */
type Plan = { a: Action; t: string; why: string; view: "plan" | "sheet" };

function plan(): Plan[] {
  const out: Plan[] = [];

  /* ── 火打（出隅4箇所）── */
  CORNERS.forEach((c, i) => {
    out.push({
      a: { type: "tapCorner", corner: c.id },
      t: `${c.nm}に寄る`,
      why:
        i === 0
          ? "火打は、足場が上から見てひし形に崩れるのを止める材。最上段の出隅4箇所に入れる。"
          : "残りの出隅も同じ。4箇所そろって初めて平面が固まる。",
      view: "plan",
    });
    out.push({
      a: { type: "hiuchiPick", corner: c.id, a: A, b: B },
      t: `${c.nm}に火打を掛ける`,
      why:
        i === 0
          ? "支柱に付ける。手摺は差し込みに遊びがあるので、引っ張られて抜ければ火打が効かない。出隅から同じ距離の支柱どうしを結んで、二等辺三角形にする。"
          : "同じ掛け方。左右で長さが違うと力が片側へ偏る。",
      view: "plan",
    });
  });
  out.push({
    a: { type: "toSheet" },
    t: "シートへ進む",
    why: "4隅に三角形ができた。これで平面がねじれない。ここまで来てからシートを張る。",
    view: "plan",
  });

  /* ── シートを垂らす ── */
  SHEET_SPANS.forEach((i) => {
    out.push({
      a: { type: "tapSpan", span: i },
      t: `${i + 1}スパン目にシートを垂らす`,
      why:
        i === 0
          ? "縦張り、1スパンに1枚、重ねしろ無し。最上段から下へ垂らす。先に全部垂らしてから結ぶ。"
          : "同じように垂らす。1枚ずつ結んでいくと、上へ何度も戻ることになる。",
      view: "sheet",
    });
    if (i === 0) {
      out.push({
        a: { type: "spreadPick", span: i, foot: true },
        t: "足で挟んで押さえる",
        why: "広げるときは足で挟む。手だけで持つと風にあおられて持っていかれる。",
        view: "sheet",
      });
    }
  });

  /* ── 緊結ピッチ ── */
  out.push({
    a: { type: "pickPitch", pitch: 900 },
    t: "緊結ピッチを900に決める",
    why: "450か900。戸建なら900でよい。これより粗いと、風であおられたときシートが支柱から離れる。",
    view: "sheet",
  });

  /* ── 結ぶ。出隅は最後 ── */
  const order: PostKey[] = [
    ...POSTS.map((p) => p.k).filter((k) => k !== "corner" && !NEXT_TO_CORNER.includes(k)),
    ...NEXT_TO_CORNER,
    "corner",
  ];
  order.forEach((k, idx) => {
    const nearCorner = NEXT_TO_CORNER.includes(k);
    out.push({
      a: { type: "tapPost", post: k },
      t: `${postName(k)}を結ぶ`,
      why:
        idx === 0
          ? "2段目から結んでいく。どの支柱からでもいいが、出隅は最後だ。"
          : k === "corner"
            ? "出隅は最後。先に結ぶとシートが出隅側へ寄って、隣の支柱の側に隙間が空く。隙間が空けば、そこから物が落ちる。"
            : nearCorner
              ? "出隅の両隣は、出隅より先に結ぶ。ここが決まっていないと、出隅を結んだときにシートの寄る先が定まらない。"
              : "シートは支柱に結ぶ。手摺に結ぶと、手摺を外したときにシートごと落ちる。",
      view: "sheet",
    });
    tieOrder(900).forEach((koma, ki) => {
      out.push({
        a: { type: "tapKoma", koma },
        t: `${postName(k)}の${koma}コマ目を結ぶ`,
        why:
          ki === 0
            ? "上から下へ結ぶ。下から結ぶと、上が余って波打つ。"
            : `次のコマ。900ピッチなので1つ飛ばし、${koma}コマ目に結ぶ。`,
        view: "sheet",
      });
    });
    out.push({
      a: { type: "nextPost" },
      t: `${postName(k)}を結び終える`,
      why: "この支柱は結び終わり。次の支柱へ移る。1本ずつ上から下まで結んでから動く。",
      view: "sheet",
    });
  });

  return out;
}

/** 通し見学の手順を組み立てる。判定を通らない手があれば、そこで止める */
export function buildDemo(): DemoStep[] {
  const out: DemoStep[] = [];
  let s = initialState();

  for (const p of plan()) {
    const v = judge(s, p.a);
    if (v.kind !== "good") break;
    s = v.state;
    out.push({ n: out.length + 1, t: p.t, why: p.why, state: s, view: p.view, scene: v.scene });
  }
  return out;
}
