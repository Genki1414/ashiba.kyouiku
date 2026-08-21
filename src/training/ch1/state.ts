/* 第1章の状態。JSON にそのまま落とせる形にしておく（保存・再開・テストのため）。 */

import { END_INNER, MID_NEED, POSTS, SPANS, type Face, type PostId, type Side, type SpanId } from "./layout";
import { STAGE_A, buildFace, type FaceStep } from "./queue";

/** 盤面に置いた物の鍵 */
export type PlacedKey =
  | `J:${PostId}`        // 段取り：柱の位置に配ったジャッキ
  | `J:in:${PostId}`     // 段取り：内柱の位置に配ったジャッキ
  | `L:${SpanId}`        // 段取り：スパンに並べた根がらみ手摺（まだ寝ている）
  | `R6:${PostId}`       // 段取り：内柱の箇所に置いた踏板高さの600手摺
  | `P:${PostId}`        // 建方：立てた支柱
  | `PI:${PostId}`       // 建方：立てた内柱
  | `LU:${SpanId}`       // 建方：コマへ入れた根がらみ手摺
  | `BRK:${PostId}:${Face}` // 建方：掛けたブラケット（出隅は面ごとに1枚ずつ要る）
  | `R6S:${SpanId}`      // 建方：600スパンに入れた踏板高さの手摺
  | `SG:${SpanId}`       // 建方：上げた先行手摺
  | `DK:${SpanId}`;      // 建方：敷いた踏板

export type Ch1State = {
  phase: "dan" | "tate";
  /** 手摺先行工法（先行手摺を使う）で組むか */
  sk: boolean;
  /** 出隅のどちら側を600スパンにしたか。先行手摺を使うときだけ決める */
  side: Side | null;
  placed: string[];
  /** 内柱にすると決めた柱 */
  inner: PostId[];
  /** 共通ステージの進行 */
  stageA: number;
  /** 面ごとの進行 */
  face: { S: number; E: number };
  /** 共通ステージの adjust で仕上がった柱 */
  adjDone: PostId[];
  /** 離れを見た柱 */
  hanare: PostId[];
  /** 水平を出した柱 */
  level: PostId[];
  /** 内柱を600手摺でつないだ箇所 */
  innerTied: PostId[];
  /** 作業員がいま立っている場所 */
  at: PostId | null;
  /** 位置ごとのジャッキのネジ出し */
  jack: Record<string, number>;
  /** ジャッキ合わせの場面を出した回数 */
  jackSeen: number;
  /** 基準柱の両隣を立てた順 */
  ord: PostId[];
};

export const initialState = (sk = false): Ch1State => ({
  phase: "dan",
  sk,
  side: null,
  placed: [],
  inner: [],
  stageA: 0,
  face: { S: 0, E: 0 },
  adjDone: [],
  hanare: [],
  level: [],
  innerTied: [],
  at: null,
  jack: {},
  jackSeen: 0,
  ord: [],
});

export const has = (s: Ch1State, k: string) => s.placed.includes(k);

/** 段取りが済んだか。
    根がらみ手摺5本・ジャッキ6本・端部の内柱2本・中間の内柱1本・内柱ぶんのジャッキ */
export function danDone(s: Ch1State): boolean {
  const nJ = (Object.keys(POSTS) as PostId[]).filter((p) => has(s, `J:${p}`)).length;
  const nL = SPANS.filter((sp) => has(s, `L:${sp.id}`)).length;
  const endN = END_INNER.filter((p) => s.inner.includes(p)).length;
  const midN = s.inner.filter((p) => !END_INNER.includes(p)).length;
  const nJi = s.inner.filter((p) => has(s, `J:in:${p}`)).length;
  return nJ === 6 && nL === 5 && endN === 2 && midN === MID_NEED && nJi === s.inner.length;
}

/** 段取りの残り（画面のチェック欄に出す） */
export function danChecklist(s: Ch1State) {
  const nJ = (Object.keys(POSTS) as PostId[]).filter((p) => has(s, `J:${p}`)).length;
  const nL = SPANS.filter((sp) => has(s, `L:${sp.id}`)).length;
  const endN = END_INNER.filter((p) => s.inner.includes(p)).length;
  const midN = s.inner.filter((p) => !END_INNER.includes(p)).length;
  const nJi = s.inner.filter((p) => has(s, `J:in:${p}`)).length;
  return [
    { t: "根がらみ手摺を並べる", now: nL, need: 5 },
    { t: "端部の内柱を決める", now: endN, need: 2 },
    { t: "中間の内柱を決める", now: midN, need: MID_NEED },
    { t: "柱の位置にジャッキ", now: nJ, need: 6 },
    { t: "内柱の位置にジャッキ", now: nJi, need: s.inner.length },
  ];
}

/** 面ごとのキューは内柱の割り付けで変わるので、状態から都度組み立てる */
export const faceQueue = (s: Ch1State) => ({
  S: buildFace("S", s.inner, s.sk, s.side),
  E: buildFace("E", s.inner, s.sk, s.side),
});

export const inStageA = (s: Ch1State) => s.stageA < STAGE_A.length;
export const currentStageA = (s: Ch1State) => (inStageA(s) ? STAGE_A[s.stageA] : null);

/** いま手を付けられる工程。共通ステージ中はそれだけ、抜けたら南面・東面の先頭2つ */
export function activeSteps(s: Ch1State): { face: "A" | "S" | "E"; step: FaceStep }[] {
  if (inStageA(s)) return [];
  const q = faceQueue(s);
  return (["S", "E"] as const)
    .map((f) => ({ face: f, step: q[f][s.face[f]] }))
    .filter((x): x is { face: "S" | "E"; step: FaceStep } => !!x.step);
}

/** 全工程が終わったか */
export function isComplete(s: Ch1State): boolean {
  if (s.phase !== "tate" || inStageA(s)) return false;
  const q = faceQueue(s);
  return !q.S[s.face.S] && !q.E[s.face.E];
}

/** 進み具合（0..1） */
export function progress(s: Ch1State): { done: number; total: number } {
  const q = faceQueue(s);
  const total = STAGE_A.length + q.S.length + q.E.length;
  const done = (inStageA(s) ? s.stageA : STAGE_A.length) + s.face.S + s.face.E;
  return { done, total };
}
