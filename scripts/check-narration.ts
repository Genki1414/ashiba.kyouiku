/* narration-all.csv（1,683行）と curriculum.json の script[] が
   1対1で対応しているかを検証する。音声収録の前に必ず通す。
   実行: npm run check:narration */

import { readFileSync } from "node:fs";
import path from "node:path";
import { CurriculumSchema } from "../src/types/curriculum";

const root = process.cwd();
const cur = CurriculumSchema.parse(
  JSON.parse(readFileSync(path.join(root, "content", "curriculum.json"), "utf-8")),
);
const csv = readFileSync(path.join(root, "content", "narration-all.csv"), "utf-8");

/* CSV は text 列が二重引用符で囲まれる（中の " は "" にエスケープ） */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const lines = csv.split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0]);
const idx = (name: string) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`CSVに ${name} 列がありません`);
  return i;
};
const iLesson = idx("lesson_id");
const iSeq = idx("seq");
const iFile = idx("audio_file");
const iText = idx("text");

type Row = { lessonId: string; seq: number; file: string; text: string };
const rows: Row[] = lines.slice(1).map((l) => {
  const c = parseCsvLine(l);
  return { lessonId: c[iLesson], seq: parseInt(c[iSeq], 10), file: c[iFile], text: c[iText] };
});

let errors = 0;
const fail = (msg: string) => {
  errors++;
  console.error(`NG  ${msg}`);
};

/* 1) 行数 */
const scriptTotal = cur.subjects.reduce(
  (n, s) => n + s.lessons.reduce((m, l) => m + l.script.length, 0),
  0,
);
if (rows.length !== scriptTotal) fail(`行数不一致: csv=${rows.length} script合計=${scriptTotal}`);

/* 2) 単元ごとに seq・本文・ファイル名を突き合わせる */
const byLesson = new Map<string, Row[]>();
for (const r of rows) {
  const a = byLesson.get(r.lessonId) ?? [];
  a.push(r);
  byLesson.set(r.lessonId, a);
}
for (const s of cur.subjects) {
  for (const l of s.lessons) {
    const rs = (byLesson.get(l.id) ?? []).sort((a, b) => a.seq - b.seq);
    if (rs.length !== l.script.length) {
      fail(`${l.id}: 行数不一致 csv=${rs.length} script=${l.script.length}`);
      continue;
    }
    rs.forEach((r, i) => {
      if (r.seq !== i + 1) fail(`${l.id}: seq が飛んでいる (${r.seq} ≠ ${i + 1})`);
      const expectFile = `${l.id}-${String(i + 1).padStart(3, "0")}.mp3`;
      if (r.file !== expectFile) fail(`${l.id} #${i + 1}: ファイル名 ${r.file} ≠ ${expectFile}`);
      if (r.text !== l.script[i]) fail(`${l.id} #${i + 1}: 本文が script[] と一致しない`);
    });
  }
}

if (errors) {
  console.error(`\n${errors} 件の不一致`);
  process.exit(1);
}
console.log(`OK  ${rows.length} 行すべて curriculum.json の script[] と一致`);
