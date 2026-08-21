/* 第2章の割り付け。戸建・一側足場の南面だけを立面で見る。
   プロトタイプ（handoff/prototypes/ashiba-ch2-v6.tsx）の POSTS / SPANS をそのまま写したもの。

   縮尺は HANDOFF.md 4章のとおり。1段＝1,800mm、1コマ＝450mm。 */

export type PostId = "P0" | "P1" | "P2" | "P3";
export type SpanId = "P0-P1" | "P1-P2" | "P2-P3";

export const POSTS: PostId[] = ["P0", "P1", "P2", "P3"];

export const POST_NAME: Record<PostId, string> = {
  P0: "出隅",
  P1: "南①",
  P2: "南②",
  P3: "南端",
};

export const SPANS: [PostId, PostId][] = [
  ["P0", "P1"],
  ["P1", "P2"],
  ["P2", "P3"],
];
export const SPAN_IDS: SpanId[] = SPANS.map(([a, b]) => `${a}-${b}` as SpanId);

/** 内柱の箇所。南②と南端 */
export const INNER: PostId[] = ["P2", "P3"];
export const isInner = (p: PostId) => INNER.includes(p);

/** 昇降階段のあるスパン */
export const STAIR_SPAN: SpanId = "P0-P1";

/** 荷揚げは出隅側。手摺は荷揚げ側から入れる */
export const HOIST_SIDE: PostId = "P0";

/* ── 奥から手前へ ──
   支柱・受け材・踏板は奥（南端）から。手摺だけが荷揚げ側（出隅）から。 */
export const FAR: PostId[] = [...POSTS].reverse();
export const FAR_SPANS: [PostId, PostId][] = [...SPANS].reverse();

/* ── 転落防止手摺の高さ（2段目の踏板から）── */
export const FALL_MID = 2250 / 1800; // 中さん 2,250
export const FALL_TOP = 2700 / 1800; // 上さん 2,700

/* ── 筋交（HANDOFF.md 3章 第2章）──
   向きは一方向のみ。下端＝南端側、上端＝出隅側。1段につき1本。
   段を上がるごとに1スパン寄せて、3本が一直線に揃う。 */
export const BRACE_AT: Record<1 | 2 | 3, SpanId> = {
  1: SPAN_IDS[2], // 地上から　南②〜南端
  2: SPAN_IDS[1], // 1段目から　南①〜南②
  3: SPAN_IDS[0], // 2段目から　出隅〜南①
};

/** 筋交を入れるときに立っている高さ（0=地上 / 1=1段目 / 2=2段目） */
export const BRACE_FROM: Record<1 | 2 | 3, 0 | 1 | 2> = { 1: 0, 2: 1, 3: 2 };

export const spanName = (id: SpanId) =>
  id.split("-").map((p) => POST_NAME[p as PostId]).join("〜");
