"use client";

/* 受講中の照合。
   1. FaceDetector API（対応ブラウザ）… 顔なし／複数人を判定
   2. 簡易画像解析 … 手やテープでレンズを塞いだ・暗い・動きなしを判定
   すべて端末内で完結し、映像・静止画は保存も送信もしない。

   ふつうのパソコンの Chrome には FaceDetector が無い。
   つまり実際にはほとんどの人が 2 で見られている。
   2 が甘いと、手で塞いでも受講できてしまう。 */

export type VerifyReason = "no_face" | "multi_face" | "blocked" | "no_motion";
export type VerifyResult = { ok: true } | { ok: false; reason: VerifyReason; msg: string };

export const REASON_MSG: Record<VerifyReason, string> = {
  no_face: "顔を検出できません",
  multi_face: "複数人を検出しました",
  blocked: "カメラが遮られています",
  no_motion: "動きを検出できません",
};

const ng = (reason: VerifyReason): VerifyResult => ({ ok: false, reason, msg: REASON_MSG[reason] });

type FaceDetectorLike = { detect: (v: HTMLVideoElement) => Promise<unknown[]> };
type FaceDetectorCtor = new (opts: { fastMode: boolean }) => FaceDetectorLike;

let detector: FaceDetectorLike | null | undefined;
function getDetector(): FaceDetectorLike | null {
  if (detector !== undefined) return detector;
  const w = window as unknown as { FaceDetector?: FaceDetectorCtor };
  detector = w.FaceDetector ? new w.FaceDetector({ fastMode: true }) : null;
  return detector;
}

export async function detectFace(
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  prevRef: { current: Uint8Array | null },
): Promise<VerifyResult> {
  if (!video || !canvas || video.videoWidth === 0) return ng("no_face");

  try {
    const d = getDetector();
    if (d) {
      const faces = await d.detect(video);
      if (faces.length === 0) return ng("no_face");
      if (faces.length > 1) return ng("multi_face");
      return { ok: true };
    }
  } catch {
    /* FaceDetector が使えない → 簡易解析へ */
  }

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return ng("no_face");
  ctx.drawImage(video, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const g = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    g[j] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
  }
  const l = look(g, prevRef.current);
  prevRef.current = g;
  return judgeLook(l);
}

/* ── 簡易画像解析 ──────────────────────────
   映像を 64×48 の白黒に落として、4つの数だけを見る。 */

export const W = 64;
export const H = 48;

export type Look = {
  /** 明るさの平均。暗幕・白飛びを見る */
  mean: number;
  /** 明るさのばらつき。塞ぐと「のっぺり」して小さくなる */
  sd: number;
  /** 前の絵との差。止まっていれば小さい。前が無ければ大きい値 */
  motion: number;
};

/* しきい値。手で塞いだ絵と、ふつうに写っている絵を分ける所。

   手をレンズに当てると、画面が一色に近くなって ばらつき（sd）が
   2〜8 まで落ちる。人が写っていれば、顔の陰と背景の差で 30 以上ある。
   その間は広く空いているので、14 で切る。

   ここで捕まえられるのは「塞いだ・暗くした・止まっている」まで。
   カメラを人の居ない部屋へ向けたままにするのは、この計算では分からない
   （FaceDetector のあるブラウザなら 顔なし で捕まる）。 */
const DARK = 28;     // これより暗ければ、何も写っていない
const BRIGHT = 246;  // 白飛び。ライトを当てて塞ぐのも同じ扱い
const FLAT_SD = 14;  // のっぺり＝レンズを塞いでいる
const STILL = 0.6;   // 動きなし

export function look(g: Uint8Array, prev: Uint8Array | null): Look {
  let sum = 0;
  for (let j = 0; j < g.length; j++) sum += g[j];
  const mean = sum / g.length;

  let v = 0;
  for (let j = 0; j < g.length; j++) v += (g[j] - mean) ** 2;
  const sd = Math.sqrt(v / g.length);

  const same = !!prev && prev.length === g.length;
  let diff = 0;
  if (same && prev) for (let j = 0; j < g.length; j++) diff += Math.abs(g[j] - prev[j]);

  return { mean, sd, motion: same ? diff / g.length : 99 };
}

export function judgeLook(l: Look): VerifyResult {
  if (l.mean < DARK) return ng("blocked");
  if (l.mean > BRIGHT) return ng("blocked");
  if (l.sd < FLAT_SD) return ng("blocked");
  if (l.motion < STILL) return ng("no_motion");
  return { ok: true };
}

/* 登録用の顔写真 → 端末内の特徴量（縮小グレースケール）。
   元画像は保存しない。将来の本人照合（MediaPipe等）に置き換える前提の簡易表現。 */
export function toFeature(video: HTMLVideoElement, canvas: HTMLCanvasElement): number[] | null {
  if (video.videoWidth === 0) return null;
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  const v: number[] = [];
  for (let i = 0; i < d.length; i += 4) {
    v.push(Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114));
  }
  return v;
}
