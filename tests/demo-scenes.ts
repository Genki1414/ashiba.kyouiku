/* 通し見学の点検：場面で聞くことが、その手の説明に書いてあるか。

   通し見学は「読んでから、やる」。場面を1手前に付けると、
   まだ話していないことを聞くことになって、初見では答えようがない。
   （げんきさん指摘：内柱を立てる→踏板手摺、ジャッキ→柱を挿す）

   実行: npx tsx tests/demo-scenes.ts */

import { STEPS } from "@/training/catalog/demoSteps";
import { DEMO_SCENES } from "@/training/catalog/demoScenes";
import { buildDemo as buildCh2 } from "@/training/ch2/demo";
import { buildDemo as buildCh3 } from "@/training/ch3/demo";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => {
  if (c) ok++;
  else {
    ng++;
    console.error("NG:", m);
  }
};
/** その手の文面（見出し＋説明＋なぜ）に、言葉が入っているか */
const says = (text: string, words: string[]) => words.some((w) => text.includes(w));

/* ── 第1章 ── */
console.log("── 第1章の通し見学");

/** 場面が聞くこと → その手の文面に必ず入っているべき言葉 */
const CH1_WORDS: Record<string, string[]> = {
  jackAdjust: ["挿す"],          // 高さを合わせて「柱を挿す」まで通しでやる
  hanare: ["離れ"],
  level: ["水平"],
  innerChoiceA: ["手摺"],        // 「次にどうする？」の答え
  railAnim: ["手摺"],
  innerChoiceB: ["支柱"],        // 「水平器はどこに当てる？」の答え
  levelInner: ["水平"],
};

for (const [n, scenes] of Object.entries(DEMO_SCENES)) {
  const st = STEPS.find((s) => s.n === Number(n));
  check(!!st, `${n}手目が通し見学にある`);
  if (!st) continue;
  const text = `${st.t} ${st.d} ${st.why}`;
  for (const sc of scenes) {
    const words = CH1_WORDS[sc.type] ?? [];
    check(
      words.length > 0,
      `場面「${sc.type}」に、説明に要る言葉が決めてある`,
    );
    check(
      says(text, words),
      `${n}手目の説明に「${words.join("／")}」がある（場面 ${sc.type}）＝読んでから、やる`,
    );
  }
}

/* ジャッキは「柱を挿す」手に付いている（高さを合わせる手ではない） */
const jackStep = Object.entries(DEMO_SCENES).find(([, v]) =>
  v.some((s) => s.type === "jackAdjust"),
);
check(!!jackStep, "ジャッキの場面がある");
if (jackStep) {
  const st = STEPS.find((s) => s.n === Number(jackStep[0]))!;
  check(st.t.includes("挿す"), `ジャッキの場面は「挿す」手に付いている（いま ${st.n} ${st.t}）`);
}

/* ── 第2章・第3章 ── */
const CH23_WORDS: Record<string, string[]> = {
  belt: ["安全帯"],
  rail: ["中さん", "低い方から"],
  brace: ["筋交"],
  wjack: ["壁当てジャッキ"],
  hiuchi: ["支柱", "二等辺三角形"],
  spread: ["足で挟"],
  tie: ["上から", "結ぶ"],
};

for (const [nm, steps] of [
  ["第2章", buildCh2() as { n: number; t: string; why: string; scene?: { type: string } }[]],
  ["第3章", buildCh3() as { n: number; t: string; why: string; scene?: { type: string } }[]],
] as const) {
  console.log(`── ${nm}の通し見学`);
  let count = 0;
  for (const st of steps) {
    if (!st.scene) continue;
    count++;
    const words = CH23_WORDS[st.scene.type] ?? [];
    check(words.length > 0, `場面「${st.scene.type}」に、説明に要る言葉が決めてある`);
    check(
      says(`${st.t} ${st.why}`, words),
      `${nm} ${st.n}手目の説明に「${words.join("／")}」がある（場面 ${st.scene.type}）＝読んでから、やる`,
    );
  }
  check(count > 0, `${nm}に操作してもらう場面がある（${count}手）`);
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
