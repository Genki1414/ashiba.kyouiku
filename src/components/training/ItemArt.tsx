"use client";

import type { ReactNode } from "react";

/* 資材の絵。プロトタイプ ashiba-glossary-v9.tsx の Pic をそのまま移植。
   縦横比を保ったまま入れ物いっぱいに広げる（HANDOFF.md 4章）。 */

export function ItemArt({ id, big }: { id: string; big?: boolean }) {
  const V = (kids: ReactNode) => (
    <svg
      viewBox="0 0 86 90"
      preserveAspectRatio="xMidYMid meet"
      className={big ? "block h-full w-full" : "mx-auto block h-[76px] w-full"}
    >
      {kids}
    </svg>
  );
  const post = (x: number) => (
    <line x1={x} y1="8" x2={x} y2="78" stroke="var(--color-steel)" strokeWidth="7" />
  );
  const koma = (x: number, y: number) => (
    <polygon
      points={`${x - 6},${y} ${x},${y - 4} ${x + 6},${y} ${x},${y + 4}`}
      fill="var(--color-steel-lt)"
    />
  );

  switch (id) {
      case "jack":
        return V(<>
          <rect x="38" y="26" width="10" height="52" fill={"var(--color-steel)"} />
          {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1="36" y1={70 - i * 7} x2="50" y2={70 - i * 7} stroke={"var(--color-steel-dk)"} strokeWidth="2" />)}
          <rect x="34" y="8" width="18" height="42" fill={"var(--color-steel)"} stroke={"var(--color-steel-dk)"} />
          <rect x="28" y="46" width="30" height="9" rx="3" fill="#7E8A96" />
          <text x="62" y="54" fontSize="8" fill={"var(--color-dim)"}>ハンドル</text>
          <rect x="22" y="78" width="42" height="6" rx="1" fill={"var(--color-steel-lt)"} />
        </>);
      case "koma":
        return V(<>
          {post(43)}
          {[22, 40, 58].map((y) => <g key={y}>{koma(43, y)}</g>)}
          <line x1="60" y1="22" x2="60" y2="40" stroke={"var(--color-yel)"} strokeWidth="1.4" />
          <text x="66" y="35" fontSize="9" fill={"var(--color-yel)"}>450</text>
        </>);
      case "pole":
        return V(<>
          {post(43)}
          {[18, 30, 42, 54, 66].map((y) => <g key={y}>{koma(43, y)}</g>)}
          <rect x="37" y="44" width="12" height="5" fill={"var(--color-steel-dk)"} />
        </>);
      case "inner":
        return V(<>
          <rect x="4" y="8" width="16" height="70" fill="#242B33" />
          {post(30)}{post(62)}
          <line x1="30" y1="34" x2="62" y2="34" stroke={"var(--color-cyan)"} strokeWidth="5" />
          {koma(30, 20)}{koma(62, 20)}
          <text x="30" y="86" textAnchor="middle" fontSize="8.5" fill={"var(--color-dim)"}>内</text>
          <text x="62" y="86" textAnchor="middle" fontSize="8.5" fill={"var(--color-dim)"}>外</text>
        </>);
      case "negarami":
        return V(<>
          {post(20)}{post(66)}
          <line x1="20" y1="66" x2="66" y2="66" stroke={"var(--color-yel)"} strokeWidth="6" strokeLinecap="round" />
          <polygon points="20,60 28,66 20,72" fill={"var(--color-yel)"} /><polygon points="66,60 58,66 66,72" fill={"var(--color-yel)"} />
          <rect x="8" y="78" width="70" height="5" fill="#3A434E" />
        </>);
      case "fumiita_rail":
        return V(<>
          {post(20)}{post(66)}
          <line x1="20" y1="40" x2="66" y2="40" stroke={"var(--color-cyan)"} strokeWidth="6" strokeLinecap="round" />
          <polygon points="20,34 28,40 20,46" fill={"var(--color-cyan)"} /><polygon points="66,34 58,40 66,46" fill={"var(--color-cyan)"} />
        </>);
      case "tesuri":
        return V(<>
          {post(20)}{post(66)}
          <line x1="20" y1="26" x2="66" y2="26" stroke={"var(--color-yel)"} strokeWidth="6" strokeLinecap="round" />
          <line x1="20" y1="48" x2="66" y2="48" stroke={"var(--color-yel)"} strokeWidth="6" strokeLinecap="round" />
          <text x="74" y="29" fontSize="8" fill={"var(--color-dim)"}>上</text>
          <text x="74" y="51" fontSize="8" fill={"var(--color-dim)"}>中</text>
        </>);
      case "senko":
        return V(<>
          {post(20)}{post(66)}
          <line x1="20" y1="22" x2="66" y2="22" stroke={"var(--color-yel)"} strokeWidth="6" strokeLinecap="round" />
          <line x1="20" y1="22" x2="66" y2="60" stroke={"var(--color-yel)"} strokeWidth="3.4" />
          <line x1="66" y1="22" x2="20" y2="60" stroke={"var(--color-yel)"} strokeWidth="3.4" />
        </>);
      case "bracket":
        return V(<>
          {post(24)}
          <line x1="24" y1="40" x2="66" y2="40" stroke={"var(--color-steel-lt)"} strokeWidth="6" strokeLinecap="round" />
          <line x1="24" y1="62" x2="64" y2="42" stroke={"var(--color-steel-lt)"} strokeWidth="4" />
          <rect x="18" y="34" width="10" height="14" rx="2" fill={"var(--color-steel-dk)"} />
        </>);
      case "fumiita":
        return V(<>
          <rect x="10" y="36" width="66" height="12" rx="2" fill="#7B8895" stroke={"var(--color-steel-dk)"} />
          {[20, 32, 44, 56, 68].map((x) => <line key={x} x1={x} y1="36" x2={x} y2="48" stroke={"var(--color-steel-dk)"} strokeWidth="1" />)}
          {post(14)}{post(72)}
        </>);
      case "kaidan":
        return V(<>
          {post(16)}{post(70)}
          <line x1="18" y1="74" x2="68" y2="22" stroke={"var(--color-steel-lt)"} strokeWidth="6" strokeLinecap="round" />
          {[0, 1, 2, 3].map((i) => <line key={i} x1={26 + i * 11} y1={68 - i * 11} x2={34 + i * 11} y2={68 - i * 11} stroke={"var(--color-steel-dk)"} strokeWidth="2.6" />)}
        </>);
      case "sujikai":
        return V(<>
          {post(18)}{post(68)}
          {koma(18, 20)}{koma(68, 66)}
          <line x1="68" y1="66" x2="18" y2="20" stroke="#B9C4CE" strokeWidth="5" strokeLinecap="round" />
          <circle cx="18" cy="20" r="4" fill="#8A96A2" /><circle cx="68" cy="66" r="4" fill="#8A96A2" />
        </>);
      case "wall_jack":
        return V(<>
          <rect x="4" y="6" width="18" height="74" fill="#242B33" />
          {post(58)}
          <line x1="58" y1="44" x2="24" y2="26" stroke={"var(--color-org)"} strokeWidth="5" strokeLinecap="round" />
          <line x1="20" y1="20" x2="28" y2="32" stroke="#8A96A2" strokeWidth="5" strokeLinecap="round" />
          <circle cx="58" cy="44" r="4.5" fill={"var(--color-org)"} />
        </>);
      case "hiuchi":
        return V(<>
          <line x1="12" y1="62" x2="74" y2="62" stroke={"var(--color-steel)"} strokeWidth="5" strokeLinecap="round" />
          <line x1="12" y1="62" x2="12" y2="10" stroke={"var(--color-steel)"} strokeWidth="5" strokeLinecap="round" />
          <line x1="42" y1="62" x2="12" y2="32" stroke={"var(--color-org)"} strokeWidth="4.6" strokeLinecap="round" />
          <circle cx="12" cy="62" r="4.5" fill={"var(--color-steel-lt)"} />
          <circle cx="42" cy="62" r="4" fill={"var(--color-org)"} /><circle cx="12" cy="32" r="4" fill={"var(--color-org)"} />
        </>);
      case "sheet":
        return V(<>
          {post(16)}{post(70)}
          <rect x="20" y="12" width="46" height="64" fill="#2C6B4A" opacity=".65" />
          <path d="M20 12 L66 58 M66 12 L20 58 M20 34 L44 76 M44 12 L66 34" stroke="#5FBF8C" strokeWidth="1" opacity=".7" />
          {[22, 40, 58].map((y) => <circle key={y} cx="16" cy={y} r="3.4" fill={"var(--color-yel)"} />)}
        </>);
      case "habaki":
        return V(<>
          <rect x="10" y="42" width="66" height="10" rx="2" fill="#7B8895" stroke={"var(--color-steel-dk)"} />
          <rect x="10" y="30" width="8" height="14" fill={"var(--color-org)"} />
          <circle cx="40" cy="26" r="5" fill={"var(--color-steel-lt)"} />
        </>);
      default:
        return V(<circle cx="43" cy="43" r="20" fill={"var(--color-panel2)"} />);
    }
}
