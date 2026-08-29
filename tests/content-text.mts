/* 教材の文章に、混ざってはいけない文字が入っていないか。

   なぜ要るか。
   教材は書いて作る。書いているうちに、日本語でも英数字でもない字が
   紛れ込むことがある（キリル文字・ハングル・記号の全角半角の取り違え）。
   目で読むと日本語に見えてしまうので、気づかない。

     × 「четырьмя束で持っておきます」
     × 「変えた分담も」

   これがそのまま受講者の画面に出て、読み上げにも乗る。
   売り物の教材なので、ここは機械で止める。

   実行: npx tsx tests/content-text.mts */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CurriculumSchema, LessonSchema } from "../src/types/curriculum";
import { COURSES } from "../src/content/courses";
import { SYLLABUS, syllabusOf } from "../src/content/syllabus";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

/* 通してよい字。
   日本語（ひらがな・カタカナ・漢字）、英数字と、教材で使う記号だけ */
const ALLOW = [
  [0x20, 0x7e],       // 半角の英数字と記号
  [0x3000, 0x303f],   // 句読点・かっこ
  [0x3040, 0x309f],   // ひらがな
  [0x30a0, 0x30ff],   // カタカナ
  [0x4e00, 0x9fff],   // 漢字
  [0xff00, 0xffef],   // 全角の英数字・記号・半角カナ
] as const;
/* 教材で実際に使っている、上に入らない字 */
const EXTRA = new Set([..."①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮—…〜※→←↑↓°±×÷≦≧♪"]);

const okChar = (ch: string) => {
  const o = ch.codePointAt(0)!;
  if (EXTRA.has(ch)) return true;
  return ALLOW.some(([a, b]) => o >= a && o <= b);
};

/* 台本の中に、英語の単語が紛れていないか。

   前の見張りは半角英数字を通していたので、これを拾えなかった。

     × 「先に片side…いえ、片側を先に納めてから」

   書いているうちに英語が出てしまうことがある。読み上げにも乗る。
   数字や単位、現場で使う略語まで止めると使いものにならないので、
   **アルファベットが2文字以上つながっているもの**だけを見て、
   現場で実際に使う言葉は通す。 */
const WORD_OK = new Set([
  "KY", "KYT", "KYK", "PDCA", "RA", "TBM", "OJT", "TWI", "QC", "SDS",
  "cm", "mm", "kg", "kN", "mA", "kW", "ppm", "dB", "CSV", "PDF", "URL",
  "Zoom", "WEB", "Web", "ISO", "JIS", "LED",
]);

function latinWords(v: string): string[] {
  return [...v.matchAll(/[A-Za-z]{2,}/g)].map((m) => m[0]).filter((w) => !WORD_OK.has(w));
}

/* 文字を1つずつ見る。どのファイルの、どの言葉かまで出す */
function scan(where: string, v: unknown, hits: string[]) {
  if (typeof v === "string") {
    for (const ch of v) {
      if (!okChar(ch)) {
        const i = v.indexOf(ch);
        hits.push(`${where}: 「${ch}」（U+${ch.codePointAt(0)!.toString(16).toUpperCase()}）… ${v.slice(Math.max(0, i - 12), i + 12)}`);
      }
    }
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => scan(`${where}[${i}]`, x, hits));
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) scan(`${where}.${k}`, x, hits);
  }
}

/* ── 章立ての出どころ ──
   章立てを頭だけで決めると必ずずれる（docs/19-教材の章立ての決まり.md）。
   実際、職長教育では細目が1つ抜け、安全衛生責任者教育の2時間がまるごと抜けた。
   だから、講座には必ず出どころを残させる */
for (const c of COURSES) {
  const sy = syllabusOf(c.id);
  check(!!sy, `${c.id}: 章立ての出どころが syllabus.ts にある`);
  if (!sy) continue;
  check(sy.basis === c.basis, `${c.id}: 根拠の条文が courses.ts と一致している`);
  check(sy.totalMin === c.totalMin, `${c.id}: 時間が courses.ts と一致している（${sy.totalMin} / ${c.totalMin}）`);
  check(!!sy.saimokuFrom.trim(), `${c.id}: 細目をどの条文から取ったかが書いてある`);
  check(sy.refs.length >= 1, `${c.id}: 参考にした公開の章立てが書いてある`);
  check(sy.refs.every((r) => !!r.name.trim() && !!r.what.trim()), `${c.id}: 参考の中身まで書いてある`);
  check(!!sy.doc.trim(), `${c.id}: 裏取りの記録がどこにあるか書いてある`);
}
check(SYLLABUS.length === COURSES.length, `出どころの数と講座の数が合っている（${SYLLABUS.length} / ${COURSES.length}）`);

const dir = path.join(process.cwd(), "content", "courses");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
check(files.length > 0, "教材の json がある");

/* 職長教育は単元ごとに書いていて、まとまるのは最後。
   書いている途中のものも、ここで見ておく。
   まとまってから直すと、直す場所が増える */
const wip = path.join(process.cwd(), "content", "shokucho");
if (existsSync(wip)) {
  for (const f of readdirSync(wip).filter((x) => x.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(path.join(wip, f), "utf-8"));
    const parsed = LessonSchema.safeParse(raw);
    check(parsed.success, `職長 ${f}: 単元の形が合っている${parsed.success ? "" : ` … ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`}`);
    if (!parsed.success) continue;
    const l = parsed.data;
    const hits: string[] = [];
    scan(`職長 ${f}`, l, hits);
    check(hits.length === 0, `職長 ${f}: 混ざってはいけない字がある\n    ${hits.slice(0, 10).join("\n    ")}`);

    /* ── 例が、一つの業種に寄っていないか ──
       職長教育は建設業ぜんぶが受ける。足場だけの例で埋めると、
       鉄筋も型枠も設備も塗装も、自分の話として聞けなくなる。
       （対象の業務が決まっている特別教育は別。そこはその業務で書く） */
    const TRADE: Record<string, RegExp> = {
      足場: /足場|ジャッキ|根がらみ|壁つなぎ|踏板|くさび|敷板/,
      鉄筋: /鉄筋|配筋|結束/,
      型枠: /型枠|建て込み|支保工|墨出し/,
      鉄骨: /鉄骨|建て方|梁|柱の建入れ/,
      土工: /土工|掘削|法面|床付け|残土|丁張/,
      設備: /設備|配管|電気工事|天井内|ダクト/,
      塗装: /塗装|防水|シール|刷毛/,
      解体: /解体|ばら|撤去/,
    };
    const seen = Object.entries(TRADE).filter(([, re]) => l.script.some((x) => re.test(x))).map(([k]) => k);
    check(seen.length >= 3, `職長 ${f}: 例が3業種以上から出ている（いま ${seen.length}：${seen.join("・") || "なし"}）`);
    /* 足場が出るのは構わない。そこに寄り切っていないかを見る */
    const ashiba = l.script.filter((x) => TRADE.足場.test(x)).length;
    check(ashiba / l.script.length <= 0.25,
      `職長 ${f}: 足場の話に寄り切っていない（いま ${Math.round((ashiba / l.script.length) * 100)}%／25%まで）`);

    /* 読み上げに乗るのは台本なので、そこは特に厳しく見る */
    const eng = l.script.flatMap((x, i) => latinWords(x).map((w) => `${i + 1}行目「${w}」… ${x.slice(0, 34)}`));
    check(eng.length === 0, `職長 ${f}: 台本に英語の単語が混ざっている\n    ${eng.slice(0, 8).join("\n    ")}`);
    check(f === `${l.id}.json`, `職長 ${f}: ファイル名と単元の目印が合っている（${l.id}）`);

    /* 時間の見積りが、法定の時間とかけ離れていないか。
       台本が短すぎると、受けた人が時間を持て余す。
       長すぎると、決めた時間で終わらない */
    const t = l.budget.total_min;
    check(t >= l.legal_min * 0.9 && t <= l.legal_min * 1.1,
      `職長 ${f}: 見積り ${t}分 が法定 ${l.legal_min}分 の±10%に入っている`);
    check(l.budget.narration_chars === l.script.reduce((n, x) => n + x.length, 0),
      `職長 ${f}: 台本の字数が合っている`);
    for (const q of l.quiz) check(q.ok >= 0 && q.ok < q.a.length, `職長 ${f}: 確認問題の正解が選択肢の中にある`);
    for (const c of l.cases) check(c.options.filter((o) => o.ok).length === 1, `職長 ${f} ${c.id}: 事例の正解はひとつ`);
    for (const g of l.figures) {
      check(!!g.lead?.trim(), `職長 ${f} ${g.id}: 図解に導入の一言がある`);
      const items = g.parts ?? g.faults ?? g.points ?? g.dims ?? (g.content ? Object.values(g.content).flat() : []);
      check(items.length >= 3, `職長 ${f} ${g.id}: 図解の中身が3つ以上ある`);
    }
  }
}

for (const f of files) {
  const raw = JSON.parse(readFileSync(path.join(dir, f), "utf-8"));
  /* 形そのものも、ここで一度見ておく（画面で落ちるより先に気づく） */
  const parsed = CurriculumSchema.safeParse(raw);
  check(parsed.success, `${f}: 教材の形が合っている${parsed.success ? "" : ` … ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`}`);
  if (!parsed.success) continue;
  const cur = parsed.data;

  const hits: string[] = [];
  scan(f, cur, hits);
  check(hits.length === 0, `${f}: 混ざってはいけない字がある\n    ${hits.slice(0, 10).join("\n    ")}`);

  /* 単元の時間が、科目の時間と食い違っていないか。
     ここがずれると、受けた人の視聴時間の合計が法定に届かない */
  for (const s of cur.subjects) {
    const sum = s.lessons.reduce((n, l) => n + l.legal_min, 0);
    check(sum === s.legal_min, `${f} 科目${s.id}: 単元の合計 ${sum}分 ＝ 科目の ${s.legal_min}分`);
  }
  const all = cur.subjects.reduce((n, s) => n + s.legal_min, 0);
  check(all === cur.meta.total_min, `${f}: 科目の合計 ${all}分 ＝ 講座の ${cur.meta.total_min}分`);

  /* 単元の目印が重なっていないか。重なると記録が混ざる */
  const ids = cur.subjects.flatMap((s) => s.lessons.map((l) => l.id));
  check(new Set(ids).size === ids.length, `${f}: 単元の目印が重なっていない`);

  /* 正解の番号が、選択肢の外を指していないか */
  for (const s of cur.subjects) {
    for (const l of s.lessons) {
      l.quiz.forEach((q, i) => {
        check(q.ok >= 0 && q.ok < q.a.length, `${f} ${l.id} 確認${i + 1}: 正解の番号が選択肢の中にある`);
        check(!!q.why?.trim(), `${f} ${l.id} 確認${i + 1}: なぜそうなるかが書いてある`);
      });
      for (const fg of l.figures) {
        const t = fg.task;
        check(t.a === undefined || (t.ok !== undefined && t.ok >= 0 && t.ok < t.a.length),
          `${f} ${l.id} ${fg.id}: 図解の問いの正解が選択肢の中にある`);
      }
      /* 事例は、正解がちょうど1つ */
      for (const c of l.cases) {
        check(c.options.filter((o) => o.ok).length === 1, `${f} ${l.id} ${c.id}: 事例の正解はひとつ`);
        check(c.options.every((o) => !!o.fb?.trim()), `${f} ${l.id} ${c.id}: どの選択肢にも返す言葉がある`);
      }
    }
  }
}

console.log("── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
