"use client";
import { useEffect, useRef } from "react";
import { OK_STATE } from "@/lib/useVerification";

/* 受講中の小さなカメラ窓。照合状態を枠色と帯で示す */
export function CamWindow({
  stream,
  state,
  active,
}: {
  stream: MediaStream | null;
  state: string;
  active: boolean;
}) {
  const vRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (stream && vRef.current) vRef.current.srcObject = stream;
  }, [stream]);
  const ok = state === OK_STATE;
  return (
    <div
      className={`fixed right-2.5 top-2.5 z-30 w-[84px] overflow-hidden rounded-lg border-2 bg-black ${
        !active ? "border-line" : ok ? "border-grn" : "border-red"
      }`}
    >
      {stream ? (
        <video ref={vRef} autoPlay playsInline muted className="block w-full -scale-x-100" />
      ) : (
        <div className="px-1 py-5 text-center text-[9px] text-dim2">カメラ停止</div>
      )}
      <div
        className={`py-0.5 text-center text-[9px] ${
          !active ? "bg-panel2 text-dim" : ok ? "bg-grn text-bg" : "bg-red text-bg"
        }`}
      >
        {active ? state : "待機"}
      </div>
    </div>
  );
}
