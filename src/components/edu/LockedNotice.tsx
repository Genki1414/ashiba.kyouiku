"use client";
import { hm } from "@/components/ui/format";

/* 規定時間（legal_min）に届いていないときの表示 */
export function LockedNotice({ watchedSec, needSec }: { watchedSec: number; needSec: number }) {
  return (
    <div className="px-4 py-4">
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-1.5 text-[11px] font-bold tracking-[2px] text-yel">確認問題はまだ受けられません</div>
        <div className="text-[14px] leading-relaxed text-dim">
          規定の受講時間（{hm(needSec)}）に達すると受けられます。
          <br />
          現在 {hm(watchedSec)}。あと {hm(Math.max(0, needSec - watchedSec))} です。
          <br />
          視聴時間は、ナレーションの再生中と、図解・災害事例の表示中に加算されます。
        </div>
      </div>
    </div>
  );
}
