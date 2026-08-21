import Link from "next/link";

/* 実務トレーニングの章選択（HANDOFF.md 2章の画面の流れ） */

const CHAPTERS = [
  { id: "ch1", n: 1, t: "段取りと根がらみ", d: "割り付け・内柱・ジャッキ合わせ・建方の基準", ready: true },
  { id: "ch2", n: 2, t: "高所作業", d: "筋交・安全帯の掛け替え・壁当てジャッキ", ready: true },
  { id: "ch3", n: 3, t: "火打とシート", d: "出隅の火打・シートの縦張りと緊結", ready: false },
  { id: "ch4", n: 4, t: "本足場", d: "準備中", ready: false },
  { id: "ch5", n: 5, t: "壁つなぎ・層間ネット", d: "準備中", ready: false },
  { id: "ch6", n: 6, t: "技能士試験の実技", d: "準備中", ready: false },
];

export default function TrainingPage() {
  return (
    <main className="pb-10">
      <div className="tape" />
      <div className="px-5 pb-4 pt-6">
        <Link href="/" className="text-[13px] text-dim no-underline">
          ← ホーム
        </Link>
        <h1 className="mt-2 text-[18px] font-black">実務トレーニング</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-dim">
          作業員を動かして足場を組む。手を間違えると親方に叱られる。
        </p>
      </div>

      <div className="grid gap-2 px-5">
        {CHAPTERS.map((c) =>
          c.ready ? (
            <div key={c.id} className="rounded-xl border border-yel bg-panel p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[12px] text-yel">第{c.n}章</span>
                <span className="text-[15px] font-black">{c.t}</span>
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-dim">{c.d}</div>
              {/* 第1章だけ、前に資材カタログと通し見学を挟む（HANDOFF.md 2章） */}
              <div className="mt-3 grid gap-2">
                {c.id === "ch1" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/training/catalog?back=/training"
                      className="rounded-lg border border-cyan p-3 text-center text-[13px] font-bold text-cyan no-underline"
                    >
                      ① 資材カタログ
                    </Link>
                    <Link
                      href="/training/demo"
                      className="rounded-lg border border-cyan p-3 text-center text-[13px] font-bold text-cyan no-underline"
                    >
                      ② 通し見学
                    </Link>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/training/${c.id}`}
                    className="rounded-lg border border-yel bg-yel p-3 text-center text-[13px] font-extrabold text-bg no-underline"
                  >
                    {c.id === "ch1" ? "③ チュートリアル" : "チュートリアル"}
                  </Link>
                  <Link
                    href={`/training/${c.id}?mode=honban`}
                    className="rounded-lg border border-line p-3 text-center text-[13px] font-bold text-txt no-underline"
                  >
                    本番
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div key={c.id} className="rounded-xl border border-line bg-panel p-4 opacity-55">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[12px] text-dim">第{c.n}章</span>
                <span className="text-[15px] font-black text-dim">{c.t}</span>
              </div>
              <div className="mt-1 text-[12px] text-dim2">{c.d}</div>
            </div>
          ),
        )}
      </div>

      <p className="mt-5 px-5 text-[11.5px] leading-relaxed text-dim2">
        はじめての方は ① → ② → ③ の順に。資材の名前を覚えてから、
        組む手順を最後まで見て、それから自分で組みます。
        <br />
        チュートリアルは「親方に聞く」が使えます。本番は聞けず、設置箇所の目印も薄くなります。
      </p>
    </main>
  );
}
