"use client";
import { Btn } from "@/components/ui/Btn";

/* 照合失敗・在席確認の一時停止。表示中は視聴時間が加算されない */
export function VerifyModal({
  kind,
  message,
  onResume,
}: {
  kind: "presence" | "fail";
  message: string;
  onResume: () => void;
}) {
  const presence = kind === "presence";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-5">
      <div
        className={`w-full max-w-[340px] rounded-2xl border-2 bg-panel p-5 ${
          presence ? "border-yel" : "border-red"
        }`}
      >
        <div className={`text-[11px] font-extrabold tracking-widest ${presence ? "text-yel" : "text-red"}`}>
          {presence ? "在席確認" : "受講を一時停止しました"}
        </div>
        <div className="mb-1 mt-2 text-[15px] font-extrabold leading-relaxed">
          {presence ? "受講中であることを確認します。" : message}
        </div>
        <div className="mb-3.5 text-[12.5px] leading-relaxed text-dim">
          {presence
            ? "押されるまで視聴時間は加算されません。確認した時刻は受講記録に残ります。"
            : "カメラの正面に、お一人で映る状態にしてください。停止しているあいだ、視聴時間は加算されません。この停止は記録に残ります。"}
        </div>
        <Btn tone="y" onClick={onResume} testid="verify-resume">
          受講を続ける
        </Btn>
      </div>
    </div>
  );
}
