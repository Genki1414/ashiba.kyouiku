"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* 前面カメラ。取得したストリームはこのフックの中だけで持ち、
   映像をサーバへ送る経路は作らない。 */

export type Camera = {
  stream: MediaStream | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
};

export function useCamera(): Camera {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "カメラの使用が許可されていません"
          : name === "NotFoundError"
            ? "カメラが見つかりません"
            : "カメラを起動できません",
      );
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => stop, [stop]); // アンマウントで確実に停止

  return { stream, error, start, stop };
}
