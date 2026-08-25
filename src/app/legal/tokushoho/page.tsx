import { LegalPage } from "@/components/legal/Page";
import { tokushoho } from "@/content/legal";
import { unitPrice } from "@/lib/price.server";

export const metadata = { title: "特定商取引法に基づく表記" };

/* 特定商取引法に基づく表記。買う前に誰でも読めるところに置く */
export default function TokushohoPage() {
  const items = tokushoho(unitPrice());
  return (
    <LegalPage title="特定商取引法に基づく表記" updated="2026年8月24日">
      <dl className="grid gap-0" data-testid="tokushoho">
        {items.map((it) => (
          <div key={it.k} className="border-t border-line py-3">
            <dt className="text-[11px] tracking-[1.5px] text-dim">{it.k}</dt>
            <dd className="mt-1 text-[13px] leading-[1.9]">
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
