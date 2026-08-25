"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/lib/camera";
import { detectFace, REASON_MSG, type VerifyReason } from "@/lib/face";

/* 受講中の照合。
   - カメラあり：3秒間隔で照合し、2回連続で失敗したら停止（SPEC 5章）
   - カメラなし（記録無効で見るだけ）：10分ごとに在席確認
   失敗はサーバへ記録する（画像は送らない）。 */

/** 照合が通っているときの表示。CamWindow もこの文字で色を変える */
export const OK_STATE = "在席を確認";

const CHECK_INTERVAL_MS = 3000;
const FAIL_LIMIT = 2;
const PRESENCE_INTERVAL_MS = 10 * 60 * 1000;

export type VerifyStop = { kind: "presence" | "fail"; message: string } | null;

export function useVerification({
  lessonId,
  counting,
  useCam,
  onStop,
}: {
  lessonId: string;
  counting: boolean;
  useCam: boolean;
  onStop: () => void; // 停止時に再生を止めてもらう
}) {
  const cam = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrame = useRef<Uint8Array | null>(null);
  const miss = useRef(0);
  const [stop, setStop] = useState<VerifyStop>(null);
  const [camState, setCamState] = useState("待機");
  const stopRef = useRef(stop);
  stopRef.current = stop;

  /* カメラの起動（同意済みのときだけ） */
  useEffect(() => {
    if (useCam) cam.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCam]);

  useEffect(() => {
    const v = videoRef.current;
    if (!cam.stream || !v) return;
    v.srcObject = cam.stream;
    // display:none の video は autoplay が効かないことがある。明示的に再生する
    v.play().catch(() => {});
  }, [cam.stream]);

  /* 照合ループ */
  useEffect(() => {
    if (!counting || !useCam || !cam.stream) return;
    const id = setInterval(async () => {
      if (stopRef.current) return;
      const r = await detectFace(videoRef.current, canvasRef.current, prevFrame);
      if (r.ok) {
        /* 「本人を確認」とは言わない。ここで見ているのは
           画面の前に人が居るかどうかで、本人かどうかではない
           （本人確認は受講の準備で、顔写真と公的書類を登録するとき） */
        setCamState(OK_STATE);
        miss.current = 0;
        return;
      }
      miss.current += 1;
      setCamState(r.msg);
      if (miss.current >= FAIL_LIMIT) {
        miss.current = 0;
        setStop({ kind: "fail", message: r.msg });
        onStop();
        logFail(lessonId, r.reason);
      }
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, useCam, cam.stream, lessonId]);

  /* カメラ同意済みなのに映像が無いまま受講が進むのを防ぐ */
  useEffect(() => {
    if (!counting || !useCam || cam.stream) return;
    const id = setTimeout(() => {
      if (stopRef.current) return;
      setStop({ kind: "fail", message: "カメラが起動していません" });
      onStop();
      logFail(lessonId, "blocked");
    }, 15000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, useCam, cam.stream, lessonId]);

  /* カメラなしの在席確認 */
  useEffect(() => {
    if (!counting || useCam) return;
    const id = setInterval(() => {
      if (stopRef.current) return;
      setStop({ kind: "presence", message: "" });
      onStop();
    }, PRESENCE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, useCam]);

  const resume = () => {
    miss.current = 0;
    prevFrame.current = null;
    setStop(null);
  };

  return { cam, videoRef, canvasRef, stop, resume, camState };
}

function logFail(lessonId: string, reason: VerifyReason) {
  fetch("/api/verify-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, reason }),
  }).catch(() => {});
  // 端末内にも控えを残す（Supabase 未設定時の確認用）
  try {
    const key = "ashiba.verifyLogs";
    const logs = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    logs.push({ lessonId, reason, msg: REASON_MSG[reason], at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(logs.slice(-200)));
  } catch {
    /* 無視 */
  }
}
