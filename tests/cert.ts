/* 修了証の決まりのテスト。
   実行: npm run test:cert */

import { readFileSync } from "node:fs";
import { CERT_NO_RE, eligible, isCertNo, totalLabel } from "../src/lib/cert";
import { COURSES, LAW_VERSION, lawVersionOf, needsLive, totalNoteOf } from "../src/content/courses";
import { CARD_MM, CERT_H, CERT_MIN_H, CERT_W, DPI, certHeight } from "../src/components/edu/drawCert";
import { ISSUER_NAME, ISSUER_RESPONSIBLE, issuerName, issuerResponsible } from "../src/lib/issuer";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};

console.log("── 発行名義 ──");
/* 教育を実施したのは東北三上機材。受講者がどの会社の人かとは別 */
check(ISSUER_NAME === "東北三上機材株式会社", "事業者名が決まっている", ISSUER_NAME);
check(ISSUER_RESPONSIBLE === "中川元基", "教育実施責任者が決まっている", ISSUER_RESPONSIBLE);
check(issuerName() === ISSUER_NAME, "設定が無ければそのまま使う");
check(issuerResponsible() === ISSUER_RESPONSIBLE, "責任者も同じ");
/* 名義は受講者の会社では決まらない。どの事業者の受講者でも同じ1つ。
   特別教育を実施しているのはこの仕組みなので、
   受講する会社の名前が載ると、実施していない会社の名前で出ることになる */
check(
  typeof issuerName() === "string" && issuerName().length > 0,
  "名義は1つに決まっていて、受講者の会社では変わらない",
  issuerName(),
);
{
  /* 会社や責任者が変わったら、環境変数で上書きできる */
  process.env.CERT_ISSUER_NAME = "別の会社";
  process.env.CERT_ISSUER_RESPONSIBLE = "別の人";
  check(issuerName() === "別の会社", "環境変数があればそちらを使う");
  check(issuerResponsible() === "別の人", "責任者も上書きできる");
  delete process.env.CERT_ISSUER_NAME;
  delete process.env.CERT_ISSUER_RESPONSIBLE;
  check(issuerName() === ISSUER_NAME, "外せば元に戻る");
}

console.log("── 出せるかどうか ──");
check(eligible({ lessons: 13, lessonsPassed: 13, examPassed: true }).ok, "全部済んでいれば出せる");
{
  const v = eligible({ lessons: 13, lessonsPassed: 12, examPassed: true });
  check(!v.ok, "単元が残っていれば出せない");
  check(!v.ok && v.reason.includes("残り1単元"), "あと何単元かを言う", !v.ok ? v.reason : "");
}
{
  const v = eligible({ lessons: 13, lessonsPassed: 13, examPassed: false });
  check(!v.ok, "修了試験に受かっていなければ出せない");
  check(!v.ok && v.reason.includes("修了試験"), "何が足りないかを言う");
}
{
  const v = eligible({ lessons: 13, lessonsPassed: 0, examPassed: false });
  check(!v.ok && v.reason.includes("残り13単元"), "単元が先に出る（試験は最後だから）");
}
check(!eligible({ lessons: 0, lessonsPassed: 0, examPassed: true }).ok, "教材が無いのに出さない");

console.log("── 証明番号 ──");
/* 番号はデータベースで採る（0008 の next_cert_no）。
   ここでは形だけ見る。採番そのものは tests/admin-db.mts が実データで確かめる */
check(CERT_NO_RE.test("AT-202608-00001"), "通し番号5桁の形が通る");
check(CERT_NO_RE.test("AT-202608-1234"), "昔の4桁の番号も、照会できるよう通す");

console.log("── 照会の入り口 ──");
check(isCertNo("AT-202608-1234"), "正しい番号は通す");
check(isCertNo(" at-202608-1234 "), "小文字・前後の空白は直して通す");
check(!isCertNo("AT-2026-1234"), "年月が短いものは弾く");
check(!isCertNo("XX-202608-1234"), "頭が違うものは弾く");
check(!isCertNo(""), "空は弾く");
check(isCertNo("AT-202608-12345"), "通し番号が伸びても通す");
check(!isCertNo("AT-202608-123456789"), "桁が多すぎるものは弾く");
check(!isCertNo("AT-202608-123"), "桁が少なすぎるものは弾く");

console.log("── 合計時間 ──");
check(totalLabel([{ min: 180 }, { min: 30 }, { min: 90 }, { min: 60 }]) === "6時間（学科）", "6時間");
check(totalLabel([{ min: 90 }]) === "1時間30分（学科）", "端数は分で出す");

console.log("── 紙の大きさ（名刺サイズ）──");
/* 現場に持って行くものなので、財布に入る大きさにしてある。
   91mm × 55mm を 300dpi で刷る */
check(CARD_MM.w === 91 && CARD_MM.h === 55, `名刺サイズ（${CARD_MM.w}×${CARD_MM.h}mm）`);
check(DPI === 300, "刷るので300dpi");
check(CERT_W === 1075, `横は1075（91mm）。いま ${CERT_W}`);
check(CERT_H === 650, `縦は650（55mm）。いま ${CERT_H}`);
/* 縦横比が名刺のものになっていること。ここが崩れると刷ったときに歪む */
const ratio = CERT_W / CERT_H;
check(Math.abs(ratio - 91 / 55) < 0.01, `縦横比が名刺と合う（${ratio.toFixed(3)}）`);
/* 科目の数で大きさが変わらない（科目を載せないので） */
check(certHeight() === CERT_H, "科目の数で高さは変わらない");
check(CERT_MIN_H === CERT_H, "いちばん短いときも同じ高さ");

console.log("\n── 修了証に載る時間は、法定時間 ──");
{
  /* 討議のある講座で、各自で見るぶんだけを載せると、
     14時間の職長教育に「13時間15分」と書いた紙が出る。
     法定時間（legal_min + talk_min）を載せること。 */
  for (const c of COURSES.filter((x) => x.ready)) {
    const d = JSON.parse(
      readFileSync(new URL(`../content/courses/${c.file}`, import.meta.url), "utf8"),
    ) as { subjects: { id: number; name: string; legal_min: number; talk_min?: number }[] };
    const subs = d.subjects.map((s) => ({ min: s.legal_min + (s.talk_min ?? 0) }));
    const min = subs.reduce((n, s) => n + s.min, 0);
    check(
      min === c.totalMin,
      `${c.id}: 修了証の合計が法定時間と合う（${min}分 ／ 法定${c.totalMin}分）`,
    );
    /* 単元だけの合計では足りない講座があること自体を、ここで示しておく */
    const onDemand = d.subjects.reduce((n, s) => n + s.legal_min, 0);
    if (onDemand !== c.totalMin) {
      check(
        min > onDemand,
        `${c.id}: 討議のぶんが足されている（各自${onDemand}分 → ${min}分）`,
      );
    }
  }

  /* 札。討議のある講座に「（学科）」と書くと嘘になる */
  const six = [{ min: 360 }];
  check(totalLabel(six) === "6時間（学科）", "学科だけなら「（学科）」", totalLabel(six));
  check(
    totalLabel([{ min: 840 }], "学科・討議") === "14時間（学科・討議）",
    "討議があれば札を変えられる",
    totalLabel([{ min: 840 }], "学科・討議"),
  );
  for (const c of COURSES.filter((x) => x.ready)) {
    const note = totalNoteOf(c);
    check(
      needsLive(c) ? note.includes("討議") : note === "学科",
      `${c.id}: 札が講座に合っている（${note}）`,
    );
  }
  /* 端数のある時間も出せること */
  check(totalLabel([{ min: 795 }], "") === "13時間15分", "端数は「◯時間◯分」", totalLabel([{ min: 795 }], ""));
}

console.log("\n── 出した紙に、出したときの中身を焼き付ける（0026）──");
{
  /* なぜ要るか。
     修了証の中身を、見るたびに courses.ts の**そのときの値**から作っていると、
     法令が変わって講座を直した日に、**前に出した紙の中身まで変わる。**
     3年保存している記録が、あとから書き換わるということ。 */
  const mig = readFileSync("supabase/migrations/0026_cert_snapshot.sql", "utf8");
  for (const col of ["course_id", "course_name", "basis", "total_min", "subjects", "law_version"]) {
    check(mig.includes(`add column if not exists ${col}`), `0026 が ${col} を足している`);
  }
  const apply = readFileSync("supabase/apply-all.sql", "utf8");
  check(apply.includes("law_version"), "apply-all.sql にも入っている");

  const route = readFileSync("src/app/api/cert/route.ts", "utf8");
  /* 発行のときに書き込んでいること */
  check(/law_version:\s*r\.course\.lawVersion/.test(route), "発行のときに法令バージョンを書き込む");
  check(/course_name:\s*r\.course\.name/.test(route), "発行のときに講座名を書き込む");
  check(/subjects:\s*r\.subjects/.test(route), "発行のときに科目を書き込む");
  /* 読むときは、焼き付いた値を先に使うこと */
  check(route.includes("snap ? snap.courseName : course.name"),
    "もう出してある紙は、出したときの講座名を返す");
  check(route.includes("snap ? snap.subjects : subjects"),
    "もう出してある紙は、出したときの科目を返す");

  /* 照会。ここは固定の文字で「足場」と答えていた。
     玉掛けの修了証を照会した人に、足場の名前を見せていたということ */
  const ver = readFileSync("src/app/api/verify-cert/route.ts", "utf8");
  check(!ver.includes("足場の組立て等の業務に係る特別教育（学科）"),
    "照会が、どの番号にも「足場」と答えない");
  check(ver.includes("data.course_name"), "照会は、出した紙に焼き付いた講座名を返す");
  const vc = readFileSync("src/app/verify/VerifyClient.tsx", "utf8");
  check(vc.includes("講習名は記録に残っていません"),
    "古い紙（講座名の無い紙）は、当てずっぽうの名前を出さずに断る");

  /* 担当者が出したときも、同じものを焼き付けること。
     片方だけ書き込んでいると、担当者が出した紙にだけ中身が残らない */
  const ad = readFileSync("src/app/api/admin/cert/route.ts", "utf8");
  for (const col of ["course_name", "basis", "total_min", "subjects", "law_version"]) {
    check(new RegExp(`${col}[:,]`).test(ad), `担当者の発行も ${col} を書き込む`);
  }

  /* 法令バージョン */
  check(/^\d{4}-\d{2}-\d{2}$/.test(LAW_VERSION), "法令バージョンは日付の形", LAW_VERSION);
  for (const c of COURSES.filter((x) => x.ready)) {
    check(/^\d{4}-\d{2}-\d{2}$/.test(lawVersionOf(c)), `${c.id}: 法令バージョンが引ける`);
  }
}

console.log("── まとめ ──");

console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
