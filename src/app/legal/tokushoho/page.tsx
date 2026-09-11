import { LegalPage } from "@/components/legal/Page";
import { LEGAL_REVISED, tokushoho } from "@/content/legal";
import { allPrices } from "@/lib/price.server";
import { hasStripe } from "@/lib/stripe";
import { MAX_SEATS } from "@/lib/pricing";

export const metadata = { title: "特定商取引法に基づく表記" };

/* 値段は環境変数で変わる（SEAT_UNIT_PRICE_◯◯）。作り置きにすると、
   Vercel で値段を変えても、申込みは新しい値段で請求し、
   ここは古い値段を出し続ける。**表示価格と請求額の不一致**（2026-09-11） */
export const dynamic = "force-dynamic";

/* 特定商取引法に基づく表記。買う前に誰でも読めるところに置く */
export default function TokushohoPage() {
  /* カードを出しているかは、鍵の有無（画面と同じ判定）で決めて渡す */
  const items = tokushoho(allPrices(), { card: hasStripe(), maxSeats: MAX_SEATS });
  return (
    <LegalPage title="特定商取引法に基づく表記" updated={LEGAL_REVISED}>
      <dl className="grid gap-0" data-testid="tokushoho">
        {items.map((it) => (
          <div key={it.k} className="border-t border-line py-3">
            <dt className="text-[11px] tracking-[1.5px] text-dim">{it.k}</dt>
            <dd className="mt-1 whitespace-pre-line text-[13px] leading-[1.9]">
              {it.v ? (
                it.v
              ) : (
                <span className="text-yel" data-testid="tokushoho-missing">
                  未設定
                </span>
              )}
              {it.note && <div className="mt-0.5 text-[11.5px] text-dim2">{it.note}</div>}
            </dd>
          </div>
        ))}
      </dl>
    </LegalPage>
  );
}
