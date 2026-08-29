/* 教育時間の割り振りと、討議の完了判定。
   実行: npx tsx tests/hours.ts

   ここが崩れると、足りない教育で修了証が出る。
   職長教育は12時間以上と決まっていて、科目ごとにも最低時間がある。 */

import {
  judgeHours, judgeTalk, attendedMin, planTotal, shortOf, hm, TALK_MAX,
  type SubjectHours,
} from "@/lib/hours";
import { SHOKUCHO, SHOKUCHO_TOTAL_MIN, SEKININSHA, SEKININSHA_MIN, COURSE_TOTAL_MIN, TALK_MIN, TALK_SUBJECT } from "@/content/shokucho";
import { inWindow, EARLY_MIN, LATE_MIN } from "@/lib/liveQuery";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

console.log("── 時間の足し算 ──");
{
  check(planTotal({ lecture: 70, talk: 30, drill: 20 }) === 120, "講義＋討議＋演習");
  check(planTotal({ lecture: -10, talk: 30, drill: 20 }) === 50, "負の数は0として数える");
  check(hm(150) === "2時間30分", `2時間30分（${hm(150)}）`);
  check(hm(120) === "2時間", `2時間（${hm(120)}）`);
  check(hm(45) === "45分", `45分（${hm(45)}）`);
  check(hm(0) === "0分", "0分");
}

console.log("── 法定を下回ったら公開しない ──");
{
  const one = (legalMin: number, plan: SubjectHours["plan"]): SubjectHours =>
    ({ id: 1, name: "試し", legalMin, plan });

  const okOne = judgeHours([one(120, { lecture: 70, talk: 30, drill: 20 })], 120);
  check(okOne.ok, "ちょうど法定なら通る");

  const over = judgeHours([one(120, { lecture: 100, talk: 30, drill: 20 })], 120);
  check(over.ok && over.total === 150, "多い分には構わない");

  const short = judgeHours([one(120, { lecture: 60, talk: 30, drill: 20 })], 120);
  check(!short.ok, "1分でも足りなければ公開しない");
  check(!short.ok && short.why[0].includes("10分"), `足りない分を出す（${!short.ok ? short.why[0] : ""}）`);

  /* 科目ごとに足りていても、講座の合計が足りないことがある */
  const sumShort = judgeHours([one(60, { lecture: 60, talk: 0, drill: 0 })], 720);
  check(!sumShort.ok, "科目は足りていても、合計が足りなければ公開しない");
  check(!sumShort.ok && sumShort.why.some((w) => w.includes("合計")), "合計が足りないと言う");

  check(!judgeHours([], 720).ok, "科目が無ければ公開しない");
}

console.log("── 職長教育の中身 ──");
{
  const subs: SubjectHours[] = SHOKUCHO.map((s) => ({
    id: s.id, name: s.name, legalMin: s.legalMin, plan: s.plan,
  }));
  check(SHOKUCHO.length === 5, `科目は5つ（いま ${SHOKUCHO.length}）`);
  const legal = SHOKUCHO.reduce((n, s) => n + s.legalMin, 0);
  check(legal === 720, `法定の合計は12時間（いま ${hm(legal)}）`);
  check(SHOKUCHO_TOTAL_MIN === 720, "講座の法定時間も12時間");

  /* 法令の科目ごとの最低時間 */
  const want: [number, number][] = [[1, 120], [2, 150], [3, 240], [4, 90], [5, 120]];
  for (const [id, min] of want) {
    const s = SHOKUCHO.find((x) => x.id === id)!;
    check(s.legalMin === min, `科目${id} は ${hm(min)}（いま ${hm(s.legalMin)}）`);
  }

  const j = judgeHours(subs, SHOKUCHO_TOTAL_MIN);
  check(j.ok, `初期の割り振りで公開できる（${!j.ok ? j.why.join(" ") : hm(j.total)}）`);
  check(j.ok && j.total >= 720, "合計12時間以上");

  /* 討議は講座に1回だけ、45分。
     科目ごとに置くと、科目の数だけ日を合わせて集まることになる。
     受ける人にも講師にも重すぎる。 */
  const withTalk = SHOKUCHO.filter((s) => s.plan.talk > 0);
  check(withTalk.length === 1, `討議のある科目は1つだけ（いま ${withTalk.length}）`);
  check(withTalk[0]?.id === TALK_SUBJECT, `討議は科目${TALK_SUBJECT}に置く（いま 科目${withTalk[0]?.id}）`);
  check(TALK_MIN === 45, "討議は45分");
  check(withTalk[0]?.plan.talk === TALK_MIN, `その45分が科目の時間に入っている（${hm(withTalk[0]?.plan.talk ?? 0)}）`);

  /* 法定の細目（安衛則第40条第2項の表の左欄）が、科目ごとに入っているか。
     単元はこの細目に1つずつ対応させる。細目が抜けると、
     12時間ぶんの中身に穴が空いたまま公開されることになる */
  /* 建設業は、職長教育12時間に安全衛生責任者教育2時間を足して14時間。
     講座の名前を「職長・安全衛生責任者教育」にしている以上、この2時間が要る。
     12時間だけで修了証を出すと、受けていない教育の名前が紙に載る */
  check(SEKININSHA_MIN === 120, "安全衛生責任者教育は2時間");
  check(COURSE_TOTAL_MIN === 840, `講座ぜんぶで14時間（いま ${hm(COURSE_TOTAL_MIN)}）`);
  check(COURSE_TOTAL_MIN === SHOKUCHO_TOTAL_MIN + SEKININSHA_MIN, "12時間＋2時間になっている");
  check(SEKININSHA.saimoku.length >= 1, "安全衛生責任者のぶんにも章立てがある");
  check(!SHOKUCHO.some((s) => s.id === SEKININSHA.id), "法定の5科目とは別に持つ（混ぜない）");
  const sekiPlan = SEKININSHA.plan.lecture + SEKININSHA.plan.talk + SEKININSHA.plan.drill;
  check(sekiPlan === SEKININSHA_MIN, `安全衛生責任者の割り振りが2時間ぴったり（いま ${hm(sekiPlan)}）`);

  const SAIMOKU = 2 + 2 + 3 + 2 + 2; // 11
  const saimokuAll = SHOKUCHO.reduce((n, s) => n + s.saimoku.length, 0);
  check(saimokuAll === SAIMOKU, `細目は全部で11（いま ${saimokuAll}）`);
  for (const s of SHOKUCHO) {
    check(s.saimoku.length >= 2, `科目${s.id} に細目が2つ以上ある（いま ${s.saimoku.length}）`);
    check(s.saimoku.every((x) => x.trim().length > 0), `科目${s.id} の細目に空が無い`);
  }
  /* 細目の言い回しは条文のものを使う。言い換えると、突き合わせられなくなる */
  check(SHOKUCHO[0].saimoku[0] === "作業手順の定め方", "科目1の細目①は条文の言い回し");
  check(SHOKUCHO[2].saimoku[2] === "設備、作業等の具体的な改善の方法", "科目3の細目③は条文の言い回し");
  check(
    SHOKUCHO[4].saimoku[1] === "労働災害防止についての関心の保持及び労働者の創意工夫を引き出す方法",
    "科目5の細目②は条文の言い回し",
  );

  /* 討議が1回でも、お題はどの科目にも要る。
     討議の45分で全部は扱えないので、残りは演習で出す */
  for (const s of SHOKUCHO) {
    check(!!s.talkQuestion, `科目${s.id} にお題がある`);
    check(s.plan.drill > 0, `科目${s.id} に演習の時間がある（${hm(s.plan.drill)}）`);
  }

  /* 討議の45分を抜いても、12時間のうち45分だけが討議ということ。
     討議の分を二重に数えていないか */
  const talkAll = SHOKUCHO.reduce((n, s) => n + s.plan.talk, 0);
  check(talkAll === TALK_MIN, `講座ぜんぶで討議は45分（いま ${hm(talkAll)}）`);
  /* 中心科目は演習を厚くする */
  const three = SHOKUCHO.find((s) => s.id === 3)!;
  check(three.talk === "drill", "科目3は演習の型");
  check(three.plan.drill >= 60, `科目3の演習は1時間以上（${hm(three.plan.drill)}）`);
}

console.log("── 討議に居た時間 ──");
{
  const t = (h: number, m: number) => `2026-09-01T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
  const now = new Date(t(12, 0));

  check(attendedMin({ spans: [{ inAt: t(9, 0), outAt: t(9, 30) }], awayMin: 0 }, now) === 30, "30分居た");
  /* 途中で切れて入り直しても、足し合わせる */
  check(
    attendedMin({ spans: [{ inAt: t(9, 0), outAt: t(9, 20) }, { inAt: t(9, 25), outAt: t(9, 50) }], awayMin: 0 }, now) === 45,
    "入り直したぶんも足す",
  );
  /* 席を外していた分は引く。繋いだまま離れても時間にしない */
  check(
    attendedMin({ spans: [{ inAt: t(9, 0), outAt: t(10, 0) }], awayMin: 15 }, now) === 45,
    "離席は引く",
  );
  /* まだ出ていない回は、いまの時刻まで */
  check(attendedMin({ spans: [{ inAt: t(11, 30), outAt: null }], awayMin: 0 }, now) === 30, "まだ居る人は今まで数える");
  /* 出た時刻が入った時刻より前、という壊れた記録は数えない */
  check(attendedMin({ spans: [{ inAt: t(10, 0), outAt: t(9, 0) }], awayMin: 0 }, now) === 0, "壊れた記録は数えない");
  check(attendedMin({ spans: [], awayMin: 0 }, now) === 0, "一度も入っていなければ0");
}

console.log("── 討議を終えたと見てよいか ──");
{
  const t = (h: number, m: number) => `2026-09-01T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
  const now = new Date(t(12, 0));
  const full = { spans: [{ inAt: t(9, 0), outAt: t(9, 40) }], awayMin: 0 };
  const all = { answered: true, teacherOk: true };

  check(judgeTalk(full, 30, all, now).ok, "時間・回答・講師の確認がそろえば修了");

  /* 開いただけでは修了にしない */
  const short = judgeTalk({ spans: [{ inAt: t(9, 0), outAt: t(9, 5) }], awayMin: 0 }, 30, all, now);
  check(!short.ok && short.why === "time", "時間が足りなければ未修了");

  /* 繋いで放っておけば済む、にはしない */
  const noAns = judgeTalk(full, 30, { answered: false, teacherOk: true }, now);
  check(!noAns.ok && noAns.why === "answer", "課題に答えていなければ未修了");

  /* 最後は人が見る。討議は出席の数字だけでは測れない */
  const noT = judgeTalk(full, 30, { answered: true, teacherOk: false }, now);
  check(!noT.ok && noT.why === "teacher", "講師の確認が無ければ未修了");

  check(TALK_MAX === 15, "1回に入れるのは15人まで");

  /* 45分の回に、45分居ていなければ通さない */
  const min44 = judgeTalk({ spans: [{ inAt: t(9, 0), outAt: t(9, 44) }], awayMin: 0 }, TALK_MIN, all, now);
  check(!min44.ok && min44.why === "time", "45分の回に44分では未修了");
  check(judgeTalk({ spans: [{ inAt: t(9, 0), outAt: t(9, 45) }], awayMin: 0 }, TALK_MIN, all, now).ok, "45分居れば修了");
}

console.log("── つなぎ先（Zoom）を渡してよい時間帯 ──");
{
  /* URL は「入る」を押したときだけ返す。
     前の日から渡してしまうと、回に居なかった人の手元に部屋だけが残る */
  const start = "2026-09-01T09:00:00Z";
  const at = (h: number, m: number) =>
    new Date(`2026-09-01T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);

  check(!inWindow(start, TALK_MIN, at(8, 0)), "1時間前には渡さない");
  check(inWindow(start, TALK_MIN, at(8, 45)), `${EARLY_MIN}分前からは渡す`);
  check(inWindow(start, TALK_MIN, at(9, 30)), "やっている最中は渡す");
  /* 45分の回 ＋ 30分 ＝ 9:45+0:30 = 10:15 まで */
  check(inWindow(start, TALK_MIN, at(10, 10)), `終わって${LATE_MIN}分以内なら渡す（入り直し）`);
  check(!inWindow(start, TALK_MIN, at(10, 30)), "終わって時間が経てば渡さない");
  check(!inWindow(start, TALK_MIN, new Date("2026-09-02T09:10:00Z")), "次の日には渡さない");
  check(!inWindow("こわれた日付", TALK_MIN, at(9, 30)), "壊れた日付は渡さない");
}

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
