"use client";

/* 通し見学の拡大図（立面）。平面だけでは分かりにくい手をここで見せる。
   プロトタイプ ashiba-demo-v8.tsx の Art をそのまま移植。 */

import type { StepArt } from "@/training/catalog/demoSteps";

export function DemoArt({ kind }: { kind: StepArt }) {
  return (
    <svg viewBox="0 0 340 210" preserveAspectRatio="xMidYMid meet" className="block h-full w-full">
      <rect width="340" height="210" fill="#0C1015" />
      <text x="14" y="18" fontSize="10.5" fill="var(--color-dim2)">
        近くで見ると
      </text>
      <ArtBody kind={kind} />
    </svg>
  );
}

function ArtBody({ kind }: { kind: StepArt }) {

  const G = 168; // 地面                                     // 地面
  const pole = (x: number, top = 40) => <rect x={x - 6} y={top} width="12" height={G - top} fill={"var(--color-steel)"} />;
  const wall = <><rect x="0" y="24" width="58" height={G - 24} fill="#242B33" /><text x="29" y="100" textAnchor="middle" fontSize="11" fill="#4A545E">建物</text></>;
  const ground = <><rect y={G} width="340" height="34" fill="#1A2027" /><line x1="0" y1={G} x2="340" y2={G} stroke="#39434D" strokeWidth="2" /></>;

  if (kind === "jack") return (
    <>
      {ground}
      <rect x="128" y={G - 4} width="72" height="11" rx="2" fill="#CBD6DF" />
      <rect x="157" y={G - 130} width="14" height="130" fill="#93A0AD" />
      {Array.from({ length: 14 }, (_, i) => <line key={i} x1="155" y1={G - 10 - i * 8.6} x2="173" y2={G - 10 - i * 8.6} stroke="#5F6B78" strokeWidth="2" />)}
      <line x1="70" y1={G - 78} x2="290" y2={G - 78} stroke={"var(--color-yel)"} strokeWidth="1.6" strokeDasharray="6 5" />
      <text x="290" y={G - 90} textAnchor="end" fontSize="10.5" fill={"var(--color-yel)"}>計算で出した高さ</text>
      <rect x="140" y={G - 84} width="48" height="13" rx="3" fill={"var(--color-grn)"} />
      <text x="196" y={G - 66} fontSize="10.5" fill={"var(--color-grn)"}>ハンドルを合わせる</text>
    </>
  );
  if (kind === "hanare") return (
    <>
      {ground}{wall}
      {pole(190)}
      <line x1="58" y1={G - 40} x2="184" y2={G - 40} stroke={"var(--color-org)"} strokeWidth="2" />
      <line x1="58" y1={G - 46} x2="58" y2={G - 34} stroke={"var(--color-org)"} strokeWidth="2" />
      <line x1="184" y1={G - 46} x2="184" y2={G - 34} stroke={"var(--color-org)"} strokeWidth="2" />
      <text x="121" y={G - 48} textAnchor="middle" fontSize="11" fill={"var(--color-org)"} className="font-mono">離れ</text>
      <text x="190" y={G + 22} textAnchor="middle" fontSize="10" fill={"var(--color-dim)"}>外柱</text>
    </>
  );
  if (kind === "brk") return (
    <>
      {ground}{wall}
      {pole(210)}
      <line x1="210" y1={G - 92} x2="140" y2={G - 92} stroke={"var(--color-steel-lt)"} strokeWidth="6" strokeLinecap="round" />
      <line x1="210" y1={G - 44} x2="146" y2={G - 88} stroke={"var(--color-steel-lt)"} strokeWidth="4" />
      <text x="150" y={G - 100} fontSize="10.5" fill={"var(--color-txt)"}>ブラケット</text>
      <text x="150" y={G - 112} fontSize="9.5" fill={"var(--color-dim2)"}>ここに踏板が載る</text>
      <text x="210" y={G + 22} textAnchor="middle" fontSize="10" fill={"var(--color-dim)"}>外柱</text>
    </>
  );
  if (kind === "level") return (
    <>
      {ground}
      {pole(96)}{pole(258)}
      <line x1="96" y1={G - 34} x2="258" y2={G - 34} stroke={"var(--color-yel)"} strokeWidth="7" strokeLinecap="round" />
      <rect x="112" y={G - 50} width="70" height="15" rx="4" fill="#3A444E" stroke={"var(--color-steel-lt)"} />
      <circle cx="147" cy={G - 42} r="4.6" fill={"var(--color-grn)"} />
      <text x="147" y={G - 58} textAnchor="middle" fontSize="10.5" fill={"var(--color-txt)"}>端から少し中に置く</text>
      <text x="96" y={G + 22} textAnchor="middle" fontSize="10" fill={"var(--color-dim2)"}>ここが端</text>
    </>
  );
  if (kind === "inner") return (
    <>
      {ground}{wall}
      {pole(240)}{pole(120, 96)}
      <line x1="120" y1={G - 72} x2="240" y2={G - 72} stroke={"var(--color-cyan)"} strokeWidth="6" strokeLinecap="round" />
      <text x="180" y={G - 80} textAnchor="middle" fontSize="10.5" fill={"var(--color-cyan)"}>踏板高さの600手摺</text>
      <text x="120" y={G + 22} textAnchor="middle" fontSize="10" fill={"var(--color-dim)"}>内柱</text>
      <text x="240" y={G + 22} textAnchor="middle" fontSize="10" fill={"var(--color-dim)"}>外柱</text>
    </>
  );
  if (kind === "levelIn") return (
    <>
      {ground}{wall}
      {pole(240)}{pole(120, 96)}
      <line x1="120" y1={G - 72} x2="240" y2={G - 72} stroke={"var(--color-cyan)"} strokeWidth="6" strokeLinecap="round" />
      <rect x="104" y={G - 130} width="15" height="60" rx="4" fill="#3A444E" stroke={"var(--color-steel-lt)"} />
      <circle cx="111" cy={G - 100} r="4.6" fill={"var(--color-grn)"} />
      <text x="90" y={G - 136} fontSize="10.5" fill={"var(--color-txt)"}>内柱は支柱に当てる</text>
    </>
  );
  if (kind === "deck") return (
    <>
      {ground}{wall}
      {pole(240)}{pole(120, 96)}
      <rect x="112" y={G - 84} width="136" height="12" rx="2" fill="#7B8895" stroke={"var(--color-steel-dk)"} />
      <text x="180" y={G - 92} textAnchor="middle" fontSize="10.5" fill={"var(--color-txt)"}>踏板</text>
    </>
  );
  return null;
  return null;
}
