/* 第1章の割り付け。
   プロトタイプ（handoff/ashiba-app-v16h.tsx）の POSTS / SPANS をそのまま写したもの。
   縮尺は HANDOFF.md 4章のとおり：1コマ＝450mm、1段＝1,800mm、内柱〜外柱＝600mm。
   x,y は 1スパン＝1 の格子。建物の出隅を C として、南面へ x−、東面へ y+ に伸びる。 */

export type PostId = "C" | "S1" | "S2" | "S3" | "E1" | "E2";
export type Face = "S" | "E";
export type SpanId = "C-S1" | "S1-S2" | "S2-S3" | "C-E1" | "E1-E2";

export type Post = {
  x: number;
  y: number;
  /** 出隅（基準となる1本目） */
  corner?: boolean;
  /** 面。出隅はどちらの面にも属さない */
  face?: Face;
  /** 端部。端部には必ず内柱を立てる */
  end?: boolean;
  /** 親方が呼ぶ名前 */
  n: string;
};

export const POSTS: Record<PostId, Post> = {
  C: { x: 3, y: 0, corner: true, n: "出隅" },
  S1: { x: 2, y: 0, face: "S", n: "南①" },
  S2: { x: 1, y: 0, face: "S", n: "南②" },
  S3: { x: 0, y: 0, face: "S", end: true, n: "南端" },
  E1: { x: 3, y: 1, face: "E", n: "東①" },
  E2: { x: 3, y: 2, face: "E", end: true, n: "東端" },
};

/* ── 手摺先行工法（先行手摺を使うとき）──
   出隅の柱では、ブラケットの付くコマと先行手摺の付くコマが同じになる。
   そこで出隅のどちらか片側だけを600スパンにして、取り合いを外す。
   600 / 1800 の縮尺どおり（HANDOFF.md 4章）。 */
export type Side = "S" | "E";
export const SPAN600 = 600 / 1800;

/** 出隅のどちら側を600にしたかで、柱の位置が変わる */
export function postsFor(side: Side | null): Record<PostId, Post> {
  const p: Record<PostId, Post> = {
    C: { ...POSTS.C },
    S1: { ...POSTS.S1 },
    S2: { ...POSTS.S2 },
    S3: { ...POSTS.S3 },
    E1: { ...POSTS.E1 },
    E2: { ...POSTS.E2 },
  };
  if (side === "S") {
    p.S1.x = 3 - SPAN600;
    p.S2.x = p.S1.x - 1;
    p.S3.x = p.S2.x - 1;
  }
  if (side === "E") {
    p.E1.y = SPAN600;
    p.E2.y = SPAN600 + 1;
  }
  return p;
}

/** 600スパンの先の柱 */
export const post600 = (side: Side | null): PostId | null =>
  side === "S" ? "S1" : side === "E" ? "E1" : null;

/** 600スパン */
export const span600 = (side: Side | null): SpanId | null =>
  side === "S" ? "C-S1" : side === "E" ? "C-E1" : null;

/** 面ごとの柱の並び。どちらも出隅から始まる */
export const SOUTH: PostId[] = ["C", "S1", "S2", "S3"];
export const EAST: PostId[] = ["C", "E1", "E2"];

export const SPANS: { id: SpanId; a: PostId; b: PostId }[] = [
  { id: "C-S1", a: "C", b: "S1" },
  { id: "S1-S2", a: "S1", b: "S2" },
  { id: "S2-S3", a: "S2", b: "S3" },
  { id: "C-E1", a: "C", b: "E1" },
  { id: "E1-E2", a: "E1", b: "E2" },
];

/* ── 内柱の割り付け（HANDOFF.md 3章 第1章 ルール2）──
   端部は必ず。中間は2スパンに1本。
   端部に内柱が無いと足場が安定しない。 */
export const END_INNER: PostId[] = ["S3", "E2"];
/** 中間で内柱にしてよい位置。ここ以外は間隔が空きすぎる */
export const MID_OK: PostId[] = ["S1", "S2"];
/** 中間に必要な内柱の本数（2スパンに1本） */
export const MID_NEED = 1;

/** 建物からの離れ（mm） */
export const HANARE = 900;

/* ── ジャッキ合わせ（HANDOFF.md 3章 第1章 ルール3）──
   支柱を挿す手前で、足場の高さ計算から出した高さへハンドルを合わせる。
   ジャッキの全長は変わらない。ネジ棒に沿ってハンドルだけが上下する。 */
export const JACK_TARGET = 150; // この現場のジャッキ出し（積算アプリの計算値）
export const JACK_TOL = 15;     // この範囲に入れば合ったとみなす
/** この場面を見せる回数（ゲーム中2回だけ） */
export const JACK_SCENE_MAX = 2;

export const faceOf = (id: PostId): string =>
  POSTS[id].corner ? "出隅" : POSTS[id].face === "E" ? "東面" : "南面";

export const spanById = (id: SpanId) => SPANS.find((s) => s.id === id)!;

/** 進行方向側（水平器の置き場所と作業員を出す側）。
    南面は出隅から南へ、東面は出隅から東へ進む */
export const advanceDir = (face: Face): "south" | "east" => (face === "S" ? "south" : "east");
