import Link from "next/link";
import { BRAND } from "@/content/brand";
import { RELEASES } from "@/content/changelog";

/* 更新の一覧。お知らせを閉じたあとでも、ここから読み返せる */
export default function UpdatesPage() {
  return (
    <main className="px-5 py-6">
      <div className="tape -mx-5 mb-5" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">更新のお知らせ</div>
      <h1 className="mt-1.5 text-[20px] font-black">追加したこと・修正したこと</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-dim">
        新しい順に並んでいます。画面に割り込む知らせは出しません。
      </p>

      <div className="mt-5">
        {RELEASES.map((r) => (
          <div key={r.v} className="mb-4 rounded-xl border border-line bg-panel p-4" data-testid="update-row">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-dim">{r.d}</span>
              <span className="text-[13px] font-bold">{r.title}</span>
            </div>
            <div className="mt-2.5">
              {r.items.map((c, i) => (
                <div key={i} className="mb-2 flex gap-2.5 last:mb-0">
                  <span
                    className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                      c.k === "追加" ? "bg-grn text-bg" : "bg-cyan text-bg"
                    }`}
                    data-testid="update-kind"
                  >
                    {c.k}
                  </span>
                  <span className="text-[12.5px] leading-relaxed">{c.t}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 実務トレーニングを売っている店でだけ出す。
          売っていない店では、この道は 404 にしてある
          （src/app/training/layout.tsx） */}
      {BRAND.training && (
        <Link
          href="/training"
          className="mt-2 block rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline"
        >
          章の一覧へ
        </Link>
      )}
    </main>
  );
}
