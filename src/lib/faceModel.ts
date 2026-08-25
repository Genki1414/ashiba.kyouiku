"use client";

import type * as FA from "@vladmandic/face-api";

/* 本物の顔検出と本人照合。

   これまでは明るさとばらつきしか見ていなかったので、
   手でレンズを塞いだり、人の居ない部屋へ向けたりしても通ってしまった。
   ここでは学習済みのモデルで、

     ・顔が写っているか
     ・写っているのが何人か
     ・受講の準備で登録した本人か（顔の特徴量どうしの距離）

   を見る。すべて端末の中で動く。映像も静止画も特徴量も、外へは出さない。

   モデルは /models に置いてある（public/models）。
   3つで約6.7MB。はじめて開くときだけ落ちてきて、あとは端末に残る。 */

export const MODEL_URL = "/models";

/* 同じ人と見なす距離。face-api の目安は 0.6。
   受講の記録は法で決まった教育の証なので、少し厳しく 0.5 にする。
   厳しくしすぎると本人が弾かれるので、下げるならここだけ。 */
export const SAME_FACE = 0.5;

/* 顔として認める確からしさ。低くすると壁の模様まで顔になる */
const SCORE = 0.5;
/* 一辺の画素数。小さいほど速いが、遠くの顔を拾えない */
const INPUT = 320;

let api: typeof FA | null = null;
let loading: Promise<typeof FA> | null = null;

/** モデルを読み込む。2度目からはすぐ返る */
export function loadFace(): Promise<typeof FA> {
  if (api) return Promise.resolve(api);
  if (loading) return loading;
  loading = (async () => {
    const fa = await import("@vladmandic/face-api");
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    api = fa;
    return fa;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

/** 読み込みが済んでいるか（済むまで受講は始めない） */
export const faceReady = (): boolean => !!api;

type Src = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

/** 顔がいくつ写っているか。速いほうだけ（特徴量は取らない） */
export async function countFaces(el: Src | null): Promise<number> {
  if (!el) return 0;
  const fa = await loadFace();
  const opts = new fa.TinyFaceDetectorOptions({ inputSize: INPUT, scoreThreshold: SCORE });
  const faces = await fa.detectAllFaces(el, opts);
  return faces.length;
}

/** 顔の特徴量（128の数）を1つ取り出す。
    顔が無ければ null。複数写っていれば count で分かる */
export async function readFace(
  el: Src | null,
): Promise<{ count: number; descriptor: number[] | null }> {
  if (!el) return { count: 0, descriptor: null };
  const fa = await loadFace();
  const opts = new fa.TinyFaceDetectorOptions({ inputSize: INPUT, scoreThreshold: SCORE });
  const found = await fa
    .detectAllFaces(el, opts)
    .withFaceLandmarks(true)
    .withFaceDescriptors();
  if (!found.length) return { count: 0, descriptor: null };
  /* 複数写っているときは、いちばん大きい顔（＝手前に居る人）を見る */
  const main = found.reduce((a, b) =>
    a.detection.box.area >= b.detection.box.area ? a : b,
  );
  return { count: found.length, descriptor: Array.from(main.descriptor) };
}

/** 2つの特徴量の距離。小さいほど同じ人。SAME_FACE 未満なら本人とみなす */
export function faceDistance(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length || !a.length) return 99;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/** 登録した本人か */
export const isSamePerson = (registered: number[] | null, now: number[] | null): boolean =>
  faceDistance(registered, now) < SAME_FACE;
