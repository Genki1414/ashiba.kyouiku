"use client";

/* 通し見学の平面図。プロトタイプ ashiba-demo-v8.tsx の盤面をそのまま移植。
   その手までに置いたものを積み上げて描き、いまの作業箇所を光らせる。 */

import { STEPS, type Step } from "@/training/catalog/demoSteps";

const SP = 62;
const CO = { x: 250, y: 214 };

type Pk = "S3" | "S2" | "S1" | "CO" | "E1" | "E2";
const POSTS: { k: Pk; nm: string; x: number; y: number; f: "S" | "E" | "C" }[] = [
  { k: "S3", nm: "南端", x: CO.x - SP * 3, y: CO.y, f: "S" },
  { k: "S2", nm: "南②", x: CO.x - SP * 2, y: CO.y, f: "S" },
  { k: "S1", nm: "南①", x: CO.x - SP, y: CO.y, f: "S" },
  { k: "CO", nm: "出隅", x: CO.x, y: CO.y, f: "C" },
  { k: "E1", nm: "東①", x: CO.x, y: CO.y - SP, f: "E" },
  { k: "E2", nm: "東端", x: CO.x, y: CO.y - SP * 2, f: "E" },
];
const P = (k: string) => POSTS.find((p) => p.k === k)!;
const SPANS: [Pk, Pk][] = [
  ["S3", "S2"],
  ["S2", "S1"],
  ["S1", "CO"],
  ["CO", "E1"],
  ["E1", "E2"],
];
/* 端部＋中間の内柱 */
const INNER: Pk[] = ["S3", "S1", "E2"];
/* 内柱は建物側へ600 */
const inPos = (k: string) => {
  const p = P(k);
  return p.f === "E" ? { x: p.x - 30, y: p.y } : { x: p.x, y: p.y - 30 };
};

type Shown = Record<string, unknown>;

/** その手までに置いたものを積み上げる */
function upTo(n: number): Shown {
  return STEPS.slice(0, n + 1).reduce<Shown>((a, s) => {
    for (const [k, v] of Object.entries(s.show ?? {})) {
      if (Array.isArray(v)) a[k] = [...((a[k] as unknown[]) ?? []), ...v];
      else a[k] = v;
    }
    return a;
  }, {});
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

export function DemoBoard({ upTo: n, spot }: { upTo: number; spot: Step["spot"] }) {
  const sh = upTo(n);
  const st = STEPS[n];
  const all = !!sh.all;

  return (
    <svg viewBox="0 0 340 260" preserveAspectRatio="xMidYMid meet" className="block h-full w-full">
      <rect width="340" height="260" fill="#0C1015" />
      <text x="14" y="20" fontSize="10.5" fill="var(--color-dim2)">
        平面図（上から見たところ）
      </text>

      {/* いまの作業箇所 */}
      {(spot?.spans ?? []).map((id) => {
        const [a, b] = id.split("-");
        const p = P(a);
        const q = P(b);
        return (
          <line
            key={id}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="var(--color-yel)"
            strokeWidth="18"
            strokeLinecap="round"
            opacity=".16"
          />
        );
      })}
      {(spot?.posts ?? []).map((k) => {
        const p = P(k);
        return <circle key={k} cx={p.x} cy={p.y} r="19" fill="var(--color-yel)" opacity=".16" />;
      })}
      {(spot?.inner ?? []).map((k) => {
        const q = inPos(k);
        const p = P(k);
        return (
          <g key={k}>
            <circle cx={q.x} cy={q.y} r="17" fill="var(--color-yel)" opacity=".16" />
            <circle cx={p.x} cy={p.y} r="15" fill="var(--color-yel)" opacity=".12" />
          </g>
        );
      })}

      {/* 建物 */}
      <rect x="60" y="66" width="178" height="134" fill="#242B33" stroke="#2E3640" />
      <text x="149" y="136" textAnchor="middle" fontSize="12" fill="#4A545E">
        建物
      </text>

      {/* 踏板 */}
      {!!sh.deck &&
        SPANS.map(([a, b], i) => {
          const p = P(a);
          const q = P(b);
          const v = p.f === "E" || q.f === "E";
          return (
            <rect
              key={i}
              x={Math.min(p.x, q.x) - (v ? 9 : 0)}
              y={Math.min(p.y, q.y) - (v ? 0 : 9)}
              width={v ? 18 : Math.abs(q.x - p.x)}
              height={v ? Math.abs(q.y - p.y) : 18}
              fill="#4A5A63"
              opacity=".8"
            />
          );
        })}

      {/* 根がらみ手摺。寝かせてある間は破線、コマへ入ると実線 */}
      {SPANS.map(([a, b], i) => {
        const p = P(a);
        const q = P(b);
        const laid = (sh.ledger as number) > i || arr(sh.ledgerFix).includes(`${a}-${b}`) || all;
        if (!laid) return null;
        const fixed = arr(sh.ledgerFix).includes(`${a}-${b}`) || all;
        return (
          <line
            key={i}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={fixed ? "var(--color-yel)" : "#8A7A22"}
            strokeWidth={fixed ? 5 : 4}
            strokeLinecap="round"
            strokeDasharray={fixed ? undefined : "8 5"}
          />
        );
      })}

      {/* ジャッキ */}
      {!!sh.jack &&
        POSTS.map((p) => (
          <rect key={p.k} x={p.x - 6} y={p.y - 6} width="12" height="12" rx="2" fill="#5F6B78" />
        ))}
      {!!sh.jackIn &&
        INNER.map((k) => {
          const q = inPos(k);
          return <rect key={k} x={q.x - 5} y={q.y - 5} width="10" height="10" rx="2" fill="#5F6B78" />;
        })}

      {/* 内柱の箇所に置いた600手摺 */}
      {!!sh.inner6 &&
        INNER.map((k) => {
          const p = P(k);
          const q = inPos(k);
          return (
            <line
              key={k}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="var(--color-cyan)"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
          );
        })}

      {/* 支柱 */}
      {POSTS.map((p) => {
        const on = all || arr(sh.post).includes(p.k);
        return (
          <circle
            key={p.k}
            cx={p.x}
            cy={p.y}
            r={on ? 7 : 4}
            fill={on ? "var(--color-steel-lt)" : "#39434D"}
          />
        );
      })}

      {/* 内柱 */}
      {INNER.map((k) => {
        const q = inPos(k);
        const on = all || arr(sh.postIn).includes(k);
        return (
          <circle key={k} cx={q.x} cy={q.y} r={on ? 5.5 : 3} fill={on ? "var(--color-cyan)" : "#39434D"} />
        );
      })}

      {/* ブラケット */}
      {(all ? ["S2", "CO", "E1"] : arr(sh.brk)).map((k) => {
        const p = P(k);
        const d = p.f === "E" ? [-14, 0] : [0, -14];
        return (
          <line
            key={k}
            x1={p.x}
            y1={p.y}
            x2={p.x + d[0]}
            y2={p.y + d[1]}
            stroke="var(--color-steel-lt)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        );
      })}

      {/* 踏板高さの600手摺 */}
      {(all ? INNER : (arr(sh.rail6) as Pk[])).map((k) => {
        const p = P(k);
        const q = inPos(k);
        return (
          <line
            key={k}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke="var(--color-cyan)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        );
      })}

      {/* 離れ */}
      {arr(sh.hanare).map((k) => {
        const p = P(k);
        return (
          <g key={k}>
            <line
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={p.y - 14}
              stroke="var(--color-org)"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <text x={p.x + 6} y={p.y - 18} fontSize="10" fill="var(--color-org)" className="font-mono">
              離れ
            </text>
          </g>
        );
      })}

      {/* 水平（この手だけ出す） */}
      {arr(st.show?.level).map((id) => {
        const [a, b] = id.split("-");
        const p = P(a);
        const q = P(b);
        const mx = (p.x + q.x) / 2 - 12;
        const my = (p.y + q.y) / 2;
        return (
          <g key={id}>
            <rect x={mx - 16} y={my - 20} width="40" height="12" rx="3" fill="#3A444E" stroke="var(--color-steel-lt)" />
            <circle cx={mx + 4} cy={my - 14} r="3.4" fill="var(--color-grn)" />
          </g>
        );
      })}
      {arr(st.show?.levelIn).map((k) => {
        const q = inPos(k);
        return (
          <circle
            key={k}
            cx={q.x}
            cy={q.y}
            r="11"
            fill="none"
            stroke="var(--color-grn)"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
        );
      })}

      {/* 名前 */}
      {POSTS.map((p) => (
        <text
          key={p.k}
          x={p.f === "E" ? p.x + 16 : p.x}
          y={p.f === "E" ? p.y + 4 : p.y + 22}
          textAnchor={p.f === "E" ? "start" : "middle"}
          fontSize="10"
          fill="var(--color-dim2)"
        >
          {p.nm}
        </text>
      ))}
    </svg>
  );
}
