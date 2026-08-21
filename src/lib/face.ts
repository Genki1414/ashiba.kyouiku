"use client";

/* 受講中の照合（プロトタイプ v16h の detectFace を移植）。
   1. FaceDetector API（対応ブラウザ）… 顔なし／複数人を判定
   2. 簡易画像解析 … 明るさで遮蔽、フレーム差分で動きなしを判定
   すべて端末内で完結し、映像・静止画は保存も送信もしない。 */

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

  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return ng("no_face");
  ctx.drawImage(video, 0, 0, 64, 48);
  const d = ctx.getImageData(0, 0, 64, 48).data;
  const g = new Uint8Array(64 * 48);
  let sum = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const y = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    g[j] = y;
    sum += y;
  }
  const mean = sum / g.length;
  let diff = 0;
  if (prevRef.current) for (let j = 0; j < g.length; j++) diff += Math.abs(g[j] - prevRef.current[j]);
  const dm = prevRef.current ? diff / g.length : 99;
  prevRef.current = g;
  if (mean < 28) return ng("blocked");
  if (dm < 0.6) return ng("no_motion");
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
