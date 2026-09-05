import type { DrillGuide } from "@/content/drill";

/* 実技の実施記録の様式。

   ── なぜここで文字列を組むか ──
   この様式は2か所に出る。
     ・実技の手引きの画面（そのまま印刷できる）
     ・ダウンロード（/api/drill-record）— 会社の人が保存して、何度でも印刷する
   **同じ紙を2か所に書くと、必ず片方だけ直す日が来る。**
   だから、紙そのものはここで1回だけ組み立てて、両方がこれを使う。

   ── 何を入れるか（げんきさん・2026年9月5日）──
     ・**実施内容**。講座ごとに決めてある。チェックできる
     ・**参加者名**
     ・**実施事業者名**
     ・**実施事業者印**
   書いたものを撮って、発行申請に添える。本部が見て確認してから修了証が出る。

   中身はぜんぶ、うちが書いた定数（src/content/drill.ts）から来る。
   受け取った文字は入らないが、**組み立てるときに必ず escape する。**
   ここを素通しにすると、講座を足した人が「<」を書いた日に紙が崩れる。 */

export type RecordCourse = {
  id: string;
  name: string;
  basis: string;
};

/** 参加者を書く行の数。1回の実技で見られる人数は、そう多くない */
export const RECORD_ROWS = 12;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** **強調**を太字にする。台本と同じ書き方をそのまま使えるように */
const md = (s: string): string =>
  esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

/** 段の中の「実施内容」。
    手引きの箇条書きのうち、**全角空白で始まらない行**（＝上の階層）を拾う。
    ぶら下がりの細かい行まで並べると、紙が読めなくなる */
export const recordItemsOf = (
  guide: DrillGuide,
): { no: number; title: string; scope: string; min: number; items: string[] }[] =>
  guide.steps.map((s) => ({
    no: s.no,
    title: s.title,
    scope: s.scope,
    min: s.min,
    items: s.items.filter((x) => !x.startsWith("　")),
  }));

const CHECK = "☐";

/** 紙そのもの（囲みの中身だけ）。画面にもダウンロードにも、これが出る */
export function recordSheetHtml(course: RecordCourse, guide: DrillGuide): string {
  const steps = recordItemsOf(guide);
  const rows = guide.form
    .map(
      (r) =>
        `<tr><th>${md(r.k)}</th><td>${md(r.v)}</td></tr>`,
    )
    .join("");

  /* 参加者。**氏名だけでは、同姓の人がいる会社で分からなくなる。**
     生年月日を添える（修了証に載るのと同じ組み合わせ） */
  const people = Array.from(
    { length: RECORD_ROWS },
    (_, i) =>
      `<tr><td class="c num">${i + 1}</td><td></td><td></td><td></td></tr>`,
  ).join("");

  const content = steps
    .map(
      (s) => `
      <tr class="head">
        <td class="c num">${s.no}</td>
        <td colspan="2"><span class="sc">${esc(s.scope)}</span><br><b>${esc(s.title)}</b></td>
        <td class="c">予定 ${s.min}分</td>
        <td class="c">実施　　分</td>
      </tr>
      ${s.items
        .map(
          (it) => `<tr><td class="c">${CHECK}</td><td colspan="4">${md(it)}</td></tr>`,
        )
        .join("")}`,
    )
    .join("");

  return `<div class="sheet">
  <h1>特別教育（実技）実施記録</h1>
  <p class="sub">${esc(course.name)}<br>実技の科目「${esc(guide.subject)}」／法定 ${guide.legalMin}分以上</p>
  <p class="basis">${esc(course.basis)}</p>
  <p class="warn"><b>この様式は、この講座のためのものです。</b>ほかの講座には使えません（記入欄も実施内容も講座ごとに違います）。</p>

  <h2>1. 実施したこと</h2>
  <table class="kv"><tbody>${rows}</tbody></table>

  <h2>2. 実施事業者</h2>
  <table class="kv"><tbody>
    <tr><th>実施事業者名</th><td class="tall"></td></tr>
    <tr><th>所在地</th><td></td></tr>
    <tr><th>実施責任者（氏名）</th><td></td></tr>
    <tr><th>実技を行った人<br>（氏名・資格）</th><td class="tall"></td></tr>
    <tr><th>実施事業者印</th><td class="seal"><span class="sealbox">印</span><span class="note">※ 社印または代表者印を押してください</span></td></tr>
  </tbody></table>

  <h2>3. 参加者</h2>
  <table class="people">
    <thead><tr><th class="num">#</th><th>氏名</th><th>生年月日</th><th>署名</th></tr></thead>
    <tbody>${people}</tbody>
  </table>

  <h2>4. 実施内容（行ったものにチェック）</h2>
  <table class="content"><tbody>${content}
    <tr class="sum"><td colspan="3"><b>合計</b>（法定 ${guide.legalMin}分以上）</td><td class="c">予定 ${guide.totalMin}分</td><td class="c">実施　　分</td></tr>
  </tbody></table>

  <p class="foot">
    <b>この記録は${guide.keepYears}年間保存してください</b>（労働安全衛生規則）。<br>
    <b>合計が法定の${guide.legalMin}分を下回った場合は、修了になりません。</b><br>
    書き終えたら、この紙を撮影（またはPDFに）して、<b>受講者本人が修了証の画面から発行申請に添えて</b>送ってください。
    本部が中身を確かめてから、修了証が出せるようになります。
  </p>
</div>`;
}

/** 印刷用の見た目。画面にもダウンロードにも同じものを当てる */
export const RECORD_CSS = `
.sheet{background:#fff;color:#000;padding:14px 16px;font-family:system-ui,-apple-system,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;font-size:12px;line-height:1.5}
.sheet h1{margin:0;font-size:17px;font-weight:900;text-align:center;letter-spacing:1px}
.sheet .sub{margin:4px 0 0;text-align:center;font-size:11px}
.sheet .basis{margin:2px 0 0;text-align:center;font-size:10px;color:#444}
.sheet .warn{margin:8px 0 0;border:1px solid #000;padding:5px 7px;font-size:10.5px}
.sheet h2{margin:14px 0 4px;font-size:12.5px;font-weight:800;border-left:4px solid #000;padding-left:6px}
.sheet table{width:100%;border-collapse:collapse}
.sheet th,.sheet td{border:1px solid #000;padding:4px 6px;vertical-align:top}
.sheet .kv th{width:130px;background:#f1f1f1;text-align:left;font-weight:700}
.sheet .kv td.tall{height:30px}
.sheet td.seal{height:56px}
.sheet .sealbox{display:inline-block;width:46px;height:46px;border:1px dashed #888;border-radius:50%;text-align:center;line-height:46px;color:#888;font-size:11px}
.sheet td.seal .note{margin-left:8px;font-size:10px;color:#444}
.sheet .people th{background:#f1f1f1;font-weight:700;font-size:11px}
.sheet .people td{height:22px}
.sheet .num{width:26px}
.sheet .c{text-align:center}
.sheet .content td{font-size:11px}
.sheet .content tr.head td{background:#f1f1f1;border-top:2px solid #000}
.sheet .content .sc{font-size:9.5px;color:#444}
.sheet .content tr.sum td{border-top:2px solid #000;background:#f1f1f1}
.sheet .foot{margin:10px 0 0;font-size:10.5px;line-height:1.7}
@media print{
  @page{size:A4 portrait;margin:10mm}
  .sheet{padding:0;font-size:11px}
  .sheet h2{break-after:avoid}
  .sheet tr{break-inside:avoid}
  .noprint{display:none!important}
}
`;

/** ダウンロードする1枚もの。開いたらそのまま印刷できる */
export function recordDocHtml(course: RecordCourse, guide: DrillGuide): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>特別教育（実技）実施記録　${esc(course.name)}</title>
<style>
body{margin:0;background:#e9e9e9;padding:12px}
.paper{max-width:760px;margin:0 auto;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.2)}
.bar{max-width:760px;margin:0 auto 10px;font-family:system-ui,sans-serif;font-size:12.5px;color:#333;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bar button{font:inherit;font-weight:700;padding:7px 14px;border:1px solid #333;background:#fff;border-radius:6px;cursor:pointer}
@media print{body{background:#fff;padding:0}.paper{max-width:none;box-shadow:none}}
${RECORD_CSS}
</style></head>
<body>
<div class="bar noprint">
  <button onclick="window.print()">印刷する</button>
  <span>この様式は「${esc(course.name)}」のものです。人数分を印刷して、実技の当日に記入してください。</span>
</div>
<div class="paper">${recordSheetHtml(course, guide)}</div>
</body></html>`;
}

/** ダウンロードするときのファイル名。日本語のままだと環境で化けるので、講座の目印で付ける */
export const recordFileName = (courseId: string): string =>
  `jitsugi-record-${courseId}.html`;
