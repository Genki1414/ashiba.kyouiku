import Link from "next/link";
import { RELEASES } from "@/content/changelog";

/* 更新の一覧。お知らせを閉じたあとでも、ここから読み返せる */
export default function UpdatesPage() {
  return (
    <main className="px-5 py-6">
      <div className="tape -mx-5 mb-5" />
      <div className="text-[11px] font-extrabold tracking-[2px] text-yel">更新の一覧</div>
      <h1 className="mt-1.5 text-[20px] font-black">直したところ・足したところ</h1>

      <div className="mt-5">
        {RELEASES.map((r) => (
          <div key={r.v} className="mb-4 rounded-xl border border-line bg-panel p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-dim">{r.d}</span>
              <span className="text-[13px] font-bold">{r.title}</span>
            </div>
            <div className="mt-2.5">
              {r.items.map((c, i) => (
                <div key={i} className="mb-2 flex gap-2.5 last:mb-0">
                  <span
                    className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[11px] font-extrabold ${
                      c.k === "足した" ? "bg-grn text-bg" : "bg-cyan text-bg"
                    }`}
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

      <Link
        href="/training"
        className="mt-2 block rounded-lg border border-line p-3 text-center text-[13px] text-dim no-underline"
      >
        章の一覧へ
      </Link>
    </main>
  );
}
