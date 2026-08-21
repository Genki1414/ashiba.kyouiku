/* 通し見学の「なぜそうするのか」を、確認用に書き出す。
   実行: npm run dump:why > docs/09-通し見学の文言.md */

import { buildDemo as ch2 } from "../src/training/ch2/demo";
import { buildDemo as ch3 } from "../src/training/ch3/demo";
import { STEPS as ch1 } from "../src/training/catalog/demoSteps";

const out: string[] = [];
out.push("# 通し見学の文言（確認のお願い）");
out.push("");
out.push("各手の「なぜそうするのか」です。**第2章・第3章はこちらで書いた文言なので、");
out.push("現場の言い方として合っているか見てください。**");
out.push("違うところは、そのまま直した文を返してもらえれば差し替えます。");
out.push("");
out.push("第1章はプロトタイプからそのまま持ってきたもので、確認済みです（参考として載せます）。");
out.push("");
out.push("直す場所：");
out.push("");
out.push("| 章 | ファイル |");
out.push("|---|---|");
out.push("| 第1章 | `src/training/catalog/demoSteps.ts` |");
out.push("| 第2章 | `src/training/ch2/demo.ts` の `WHY` |");
out.push("| 第3章 | `src/training/ch3/demo.ts` の `plan()` |");
out.push("");

/* 第2章は工程の種類ごとに1つなので、まとめて出す */
out.push("---");
out.push("");
out.push("## 第2章 高所作業　← 確認をお願いします");
out.push("");
const seen2 = new Set<string>();
for (const s of ch2()) {
  if (seen2.has(s.why)) continue;
  seen2.add(s.why);
  out.push(`**${s.t}**`);
  out.push("");
  out.push(`> ${s.why}`);
  out.push("");
}

out.push("---");
out.push("");
out.push("## 第3章 火打とシート　← 確認をお願いします");
out.push("");
const seen3 = new Set<string>();
for (const s of ch3()) {
  if (seen3.has(s.why)) continue;
  seen3.add(s.why);
  out.push(`**${s.t}**`);
  out.push("");
  out.push(`> ${s.why}`);
  out.push("");
}

out.push("---");
out.push("");
out.push("## 第1章 段取りと根がらみ（確認済み・参考）");
out.push("");
for (const s of ch1) {
  out.push(`**${String(s.n).padStart(2, "0")} ${s.t}**`);
  out.push("");
  out.push(`> ${s.why}`);
  out.push("");
}

console.log(out.join("\n"));
