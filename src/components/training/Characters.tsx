"use client";

/* 作業員と親方。
   親方は顔のイラストで出し、普段の顔と怒り顔を描き分ける（HANDOFF.md 4章）。 */

const SKIN = "#E2B48C";
const NAVY = "#2F4A6B";
const YEL = "var(--color-yel)";

export type Mood = "normal" | "good" | "bad";

/** 盤面の作業員（正面向き）。身長1,700mm の縮尺に合わせてある */
export function Worker({ mood = "normal", walking }: { mood?: Mood; walking?: boolean }) {
  const eye = mood === "bad" ? 1.2 : 2.2;
  return (
    <g className={walking ? "walk" : undefined}>
      <ellipse cx="0" cy="1" rx="11" ry="4" fill="#000" opacity=".35" />
      {/* 脚 */}
      <path d="M-7 -20 L-8 -3 L-3 -3 L-2 -20 Z" fill={NAVY} />
      <path d="M7 -20 L8 -3 L3 -3 L2 -20 Z" fill={NAVY} />
      <rect x="-9" y="-5" width="7" height="4" rx="1" fill="#2A2E33" />
      <rect x="2" y="-5" width="7" height="4" rx="1" fill="#2A2E33" />
      {/* 胴 */}
      <path d="M-9 -40 L9 -40 L10 -19 L-10 -19 Z" fill="#5C7FA3" />
      <path d="M-9 -40 L9 -40 L9 -34 L-9 -34 Z" fill="#7796B5" />
      {/* 安全帯 */}
      <rect x="-10.5" y="-24" width="21" height="4.5" rx="1" fill="#2B3138" />
      <rect x="-11" y="-24" width="5" height="8" rx="1.5" fill="#6B5636" />
      <rect x="6" y="-24" width="5" height="6" rx="1.5" fill="#6B5636" />
      {/* 腕 */}
      <path d="M-9 -38 L-14 -22 L-10 -21 L-6 -35 Z" fill="#5C7FA3" />
      <path d="M9 -38 L14 -22 L10 -21 L6 -35 Z" fill="#5C7FA3" />
      <circle cx="-12" cy="-20" r="2.6" fill={SKIN} />
      <circle cx="12" cy="-20" r="2.6" fill={SKIN} />
      {/* 頭 */}
      <circle cx="0" cy="-47" r="8" fill={SKIN} />
      <circle cx={-3} cy="-47" r={eye / 1.6} fill="#2A1D14" />
      <circle cx={3} cy="-47" r={eye / 1.6} fill="#2A1D14" />
      {mood === "good" ? (
        <path d="M-3 -43 Q0 -40 3 -43" stroke="#2A1D14" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      ) : mood === "bad" ? (
        <ellipse cx="0" cy="-42.5" rx="2.4" ry="1.8" fill="#2A1D14" />
      ) : (
        <line x1="-2.5" y1="-42.5" x2="2.5" y2="-42.5" stroke="#2A1D14" strokeWidth="1.3" strokeLinecap="round" />
      )}
      {/* ヘルメット */}
      <path d="M-9.5 -51 A9.5 9.5 0 0 1 9.5 -51 Z" fill="#F5D400" />
      <rect x="-11.5" y="-52" width="23" height="3.4" rx="1.7" fill="#E0C200" />
      <path d="M-8 -49 Q0 -44 8 -49" stroke="#C9AE00" strokeWidth="1" fill="none" />
    </g>
  );
}

/** 親方の顔。angry で怒り顔に描き分ける */
export function Boss({ size = 48, angry }: { size?: number; angry?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className="shrink-0" aria-hidden>
      {/* ヘルメット */}
      <path d="M8 34 A28 24 0 0 1 64 34 Z" fill={angry ? "#E8B400" : "#F5D400"} />
      <rect x="4" y="33" width="64" height="6" rx="3" fill="#E0C200" />
      {/* 顔 */}
      <circle cx="36" cy="49" r="17" fill="#D9A97E" />
      {/* 眉。怒ると吊り上がる */}
      {angry ? (
        <path d="M24 43 L33 47 M48 43 L39 47" stroke="#2A1D14" strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <path d="M25 44 L33 43 M47 44 L39 43" stroke="#2A1D14" strokeWidth="3" strokeLinecap="round" />
      )}
      <circle cx="29" cy="51" r="2.4" fill="#2A1D14" />
      <circle cx="43" cy="51" r="2.4" fill="#2A1D14" />
      {/* 口。怒ると開く */}
      {angry ? (
        <ellipse cx="36" cy="60" rx="8" ry="5" fill="#5A1E17" />
      ) : (
        <path d="M30 60 Q36 63 42 60" stroke="#2A1D14" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* 口ひげ */}
      <rect x="28" y="55" width="16" height="3" rx="1.5" fill="#2A1D14" />
    </svg>
  );
}

/** 断面図の作業員（横向き）。正面向きを潰さず、横向きの絵を使う（HANDOFF.md 4章）
    身長1,700mm＝コマ4つ弱の縮尺 */
export function WorkerSide() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="12" ry="3" fill="#000" opacity=".3" />
      <path d="M-5 -2 L-6 -66 L2 -66 L2 -2 Z" fill={NAVY} />
      <path d="M3 -2 L2 -66 L9 -66 L8 -2 Z" fill="#2B3A4C" />
      <path d="M-8 -2 L-8 -7 L2 -7 L2 -2 Z" fill="#2B3138" />
      <path d="M-6 -64 L-8 -118 L8 -118 L7 -64 Z" fill="#5C7FA3" />
      <rect x="-8" y="-98" width="16" height="4.5" fill="#2B3138" />
      <path d="M-6 -113 L-23 -93 L-19 -88 L-2 -106 Z" fill="#5C7FA3" />
      <circle cx="-22" cy="-89" r="3.6" fill={SKIN} />
      {/* 首・頭（横顔） */}
      <rect x="-2" y="-124" width="7" height="8" fill={SKIN} />
      <circle cx="0" cy="-132" r="9" fill={SKIN} />
      <circle cx="-4" cy="-133" r="1.5" fill="#2A1D14" />
      <path d="M-9.5 -136 A9.5 9.5 0 0 1 9.5 -136 Z" fill="#F5D400" />
      <rect x="-13" y="-137" width="24" height="3.4" rx="1.7" fill="#E0C200" />
    </g>
  );
}

export { YEL };
