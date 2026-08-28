/* ナレーションの横に出す図解の割り当て。
   実行: npx tsx tests/narration.ts

   50分のあいだ字幕を1行ずつ見ているだけ、というのが直したかったこと。
   どの図解を出すかを間違えると、話と絵が食い違って、かえって邪魔になる。 */

import { readFileSync } from "node:fs";
import { figureAt, hitRow, hitTerm } from "@/components/edu/NarrationFigure";
import { CurriculumSchema } from "@/types/curriculum";
import type { Figure } from "@/types/curriculum";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

const fig = (id: string, at?: number) =>
  ({ id, t: id, min: 1, type: "list", lead: "", task: null } as unknown as Figure & { at?: number });
const withAt = (id: string, at: number) => ({ ...fig(id), at }) as Figure;

console.log("── 均等割り（at を入れていないとき）──");
{
  const fs = [fig("A"), fig("B"), fig("C"), fig("D")];
  /* 100行を4枚で割ると、0 / 25 / 50 / 75 から */
  check(figureAt(fs, 0, 100) === 0, "はじめは1枚目");
  check(figureAt(fs, 24, 100) === 0, "境の手前は、まだ1枚目");
  check(figureAt(fs, 25, 100) === 1, "境に来たら2枚目");
  check(figureAt(fs, 99, 100) === 3, "終わりは最後の1枚");
  /* 行が最後を越えても落ちない（もう一度再生などで起こりうる） */
  check(figureAt(fs, 999, 100) === 3, "行が行き過ぎても最後の1枚で止まる");
}

console.log("── 図解が無い単元 ──");
{
  check(figureAt([], 10, 100) === null, "図解が無ければ、何も出さない");
  check(figureAt([fig("A")], 10, 0) === null, "台本が無ければ、何も出さない");
}

console.log("── at を入れたとき ──");
{
  /* 均等割りでは合わないところを、手で直せる */
  const fs = [withAt("A", 0), withAt("B", 10), withAt("C", 200)];
  check(figureAt(fs, 9, 300) === 0, "at の手前は前の1枚");
  check(figureAt(fs, 10, 300) === 1, "at に来たら次の1枚");
  check(figureAt(fs, 199, 300) === 1, "次の at までは、そのまま");
  check(figureAt(fs, 200, 300) === 2, "at に来たら進む");
}

console.log("── 本物の教材で通す ──");
{
  const cur = CurriculumSchema.parse(
    JSON.parse(readFileSync(new URL("../content/courses/ashiba.json", import.meta.url), "utf8")),
  );
  for (const s of cur.subjects) {
    for (const l of s.lessons) {
      if (!l.figures.length) continue;
      /* どの行でも、必ずどれか1枚に決まる（外の番号を返さない） */
      let okAll = true;
      let sawLast = false;
      for (let i = 0; i < l.script.length; i++) {
        const n = figureAt(l.figures, i, l.script.length);
        if (n === null || n < 0 || n >= l.figures.length) okAll = false;
        if (n === l.figures.length - 1) sawLast = true;
      }
      check(okAll, `${l.id}：どの行でも、ある図解に決まる`);
      check(sawLast, `${l.id}：最後の図解まで出番がある`);
    }
  }
}

console.log("── 読んでいるところを光らせる ──");
{
  const rows = [{ n: "手すり" }, { n: "支柱（建地）" }, { n: "床材と建地とのすき間" }];
  check(hitRow(rows, "手すりは85センチ以上です。") === 0, "名前をそのまま言っていれば当たる");
  check(hitRow(rows, "支柱を立てます。") === 1, "（）の中と外、どちらでも当たる");
  check(hitRow(rows, "建地を立てます。") === 1, "言い換えでも当たる");
  check(hitRow(rows, "きょうは天気がいい。") === null, "言っていなければ光らせない");

  /* ゆるく切って当てにいくと、ここが誤爆する。
     違う所が光るのは、光らないより悪い */
  check(hitRow([{ n: "床材と建地とのすき間" }], "建地の間隔は一・八五メートル以下です。") === null,
    "「の」で切らない（建地の間隔を、床材とのすき間に当てない）");

  /* 同じ行に2つ出たら、長い方の話とみなす */
  check(hitRow([{ n: "建地" }, { n: "床材と建地とのすき間" }],
    "床材と建地とのすき間は12センチ未満です。") === 1, "長く一致した方を採る");

  /* 「〜の確保」は、台本では「〜を確保します」と言う。まるごとでは当たらない */
  check(hitRow([{ n: "離隔距離の確保" }],
    "だから、離隔距離を確保します。電圧に応じて、必要な距離が定められています。") === 0,
    "「〜の確保」は、頭（離隔距離）でも当たる");
  check(hitRow([{ n: "防護管の設置・移設の依頼" }], "電力会社へ防護管の設置を頼みます。") === 0,
    "「〜の依頼」も同じ");

  /* ただし、その行の中身そのものを指す言葉では切らない。
     切ると「作業床が昇り降りする」が「作業床の幅」に当たる */
  check(hitRow([{ n: "作業床の幅" }],
    "移動昇降式足場は、動力で作業床が昇り降りするものです。") === null,
    "「〜の幅」では切らない（別の話が寸法の行に当たらない）");
  check(hitRow([{ n: "建地の間隔" }], "建地をつなぐ水平材のうち、けた行方向に渡すものを布と呼びます。") === null,
    "「〜の間隔」でも切らない");

  /* 字幕の中で光らせる語も、同じ当て方で出す */
  check(hitTerm(rows, "手すりは85センチ以上です。") === "手すり", "字幕でも同じ語を光らせる");
  check(hitTerm(rows, "きょうは天気がいい。") === null, "当たらなければ光らせない");
}

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
