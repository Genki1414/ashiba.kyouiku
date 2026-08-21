/* 第2章の工程キュー。
   HANDOFF.md 3章の作業順序をそのままデータにしたもの。

   地上から筋交 → 昇降階段で1段目 → 安全帯を支柱に → 1段目の手摺（荷揚げ側から）
   → 安全帯を手摺へ → 支柱・内柱を継ぐ（奥から）→ ブラケット／踏板手摺
   → 壁当てジャッキ → 踏板 → 1段目から筋交 → 2段目へ → 2段目の手摺
   → 2段目から筋交 → 屋根 → 転落防止手摺（中さん2,250 → 上さん2,700） */

import {
  BRACE_AT,
  FAR,
  FAR_SPANS,
  POST_NAME,
  SPANS,
  isInner,
  spanName,
  type PostId,
  type SpanId,
} from "./layout";

export type Step =
  /** 筋交。t は "段:スパン"（段は 1=地上から / 2=1段目から / 3=2段目から） */
  | { k: "brace"; t: `${1 | 2 | 3}:${SpanId}`; d: string }
  | { k: "climb1"; d: string }
  | { k: "rail1"; t: SpanId; d: string }
  | { k: "post2"; t: PostId; d: string }
  | { k: "postI"; t: PostId; d: string }
  | { k: "brk"; t: PostId; d: string }
  | { k: "rail6"; t: PostId; d: string }
  | { k: "wjack"; t: PostId; d: string }
  | { k: "deck2"; t: SpanId; d: string }
  | { k: "climb2"; d: string }
  | { k: "rail2"; t: SpanId; d: string }
  | { k: "roof"; d: string }
  /** 転落防止手摺。t は "M:スパン"（中さん）／"U:スパン"（上さん） */
  | { k: "fall"; t: `${"M" | "U"}:${SpanId}`; d: string };

export function buildSteps(): Step[] {
  const q: Step[] = [];
  const sp = (a: PostId, b: PostId) => `${a}-${b}` as SpanId;

  /* 1段目は踏板が入っている前提。地上から筋交を入れる */
  q.push({
    k: "brace",
    t: `1:${BRACE_AT[1]}`,
    d: `地上から筋交を入れる（${spanName(BRACE_AT[1])}）　南端から出隅へ一直線に上げていく`,
  });
  q.push({ k: "climb1", d: "昇降階段で1段目に上がる" });

  /* 手摺は荷揚げ側（出隅）から */
  SPANS.forEach(([a, b]) =>
    q.push({
      k: "rail1",
      t: sp(a, b),
      d: `1段目の手摺を入れる（${POST_NAME[a]}〜${POST_NAME[b]}）　荷揚げ側から`,
    }),
  );

  /* 支柱は奥（南端）から手前へ */
  FAR.forEach((p) => {
    q.push({ k: "post2", t: p, d: `${POST_NAME[p]}の支柱を継ぐ　奥から手前へ` });
    if (isInner(p)) q.push({ k: "postI", t: p, d: `${POST_NAME[p]}の内柱も継ぐ` });
  });

  /* 受け材。内柱の箇所は踏板高さの手摺、それ以外はブラケット */
  FAR.forEach((p) => {
    if (isInner(p)) {
      q.push({ k: "rail6", t: p, d: `${POST_NAME[p]}は内柱の箇所。踏板高さの手摺で内柱とつなぐ` });
    } else {
      q.push({ k: "brk", t: p, d: `${POST_NAME[p]}にブラケットを掛ける` });
    }
  });

  /* 踏板手摺が入ってから壁当てジャッキで建物へ突っ張る */
  FAR.filter(isInner).forEach((p) =>
    q.push({
      k: "wjack",
      t: p,
      d: `${POST_NAME[p]}の内柱に壁当てジャッキを取り付ける（踏板手摺の下）`,
    }),
  );

  /* 踏板も奥から */
  FAR_SPANS.forEach(([a, b]) =>
    q.push({
      k: "deck2",
      t: sp(a, b),
      d: `2段目の踏板を敷く（${POST_NAME[a]}〜${POST_NAME[b]}）　奥から`,
    }),
  );

  /* 踏板が入ったスパンから筋交 */
  q.push({
    k: "brace",
    t: `2:${BRACE_AT[2]}`,
    d: `踏板が入ったので1段目から筋交を入れる（${spanName(BRACE_AT[2])}）　1本目の続き`,
  });
  q.push({ k: "climb2", d: "昇降階段で2段目に上がる" });

  SPANS.forEach(([a, b]) =>
    q.push({
      k: "rail2",
      t: sp(a, b),
      d: `2段目の手摺を入れる（${POST_NAME[a]}〜${POST_NAME[b]}）　荷揚げ側から`,
    }),
  );

  q.push({
    k: "brace",
    t: `3:${BRACE_AT[3]}`,
    d: `2段目から最後の筋交を入れる（${spanName(BRACE_AT[3])}）　これで一直線になる`,
  });
  q.push({ k: "roof", d: "屋根に上がる" });

  /* 転落防止手摺は低い方（中さん）から */
  SPANS.forEach(([a, b]) => {
    const id = sp(a, b);
    q.push({
      k: "fall",
      t: `M:${id}`,
      d: `転落防止手摺の中さん2,250を入れる（${POST_NAME[a]}〜${POST_NAME[b]}）`,
    });
    q.push({
      k: "fall",
      t: `U:${id}`,
      d: `続けて上さん2,700を入れる（${POST_NAME[a]}〜${POST_NAME[b]}）`,
    });
  });

  return q;
}
