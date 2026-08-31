/* ホームのお知らせの決まり。
   実行: npm run test:notice */

import { readFileSync, readdirSync } from "node:fs";
import {
  NOTICE_KINDS,
  isNoticeKind,
  needsCourse,
  noteOf,
  noticeView,
  type NoticeKind,
} from "../src/lib/noticeText";

let ok = 0;
let ng = 0;
const check = (c: boolean, label: string, extra?: string) => {
  if (c) ok++;
  else { ng++; console.error(`NG  ${label}${extra ? `\n    ${extra}` : ""}`); }
};
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/* 説明の文（コメント）を落としてから見る。落とさないと、
   自分で書いた説明に当たって「通った」ことになる */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

console.log("── 行き先 ──");
{
  /* 住所はしまわない。種類から組み立てる。
     しまうと、画面を1つ動かしただけで過ぎた行が迷子になる */
  for (const k of NOTICE_KINDS) {
    const v = noticeView({ kind: k, courseId: "ashiba" });
    check(v.href.startsWith("/"), `${k}: 自分の中の場所へ飛ぶ`, v.href);
    check(!/^https?:|^\/\//.test(v.href), `${k}: よそへ飛ばさない`, v.href);
    check(v.t.length > 0, `${k}: 見出しがある`);
    check(v.d.length > 0, `${k}: 次に何をすればいいかを書く`, v.t);
  }

  /* 講座が要る種類で、講座が抜けていても行き先が壊れないこと。
     「/edu//cert」のような、開けない住所を作らない */
  for (const k of NOTICE_KINDS) {
    const v = noticeView({ kind: k, courseId: null });
    check(!v.href.includes("//"), `${k}: 講座が無くても住所が壊れない`, v.href);
    /* 「/edu/」で終わる、開けない住所を作っていないこと。
       ホームそのもの（"/"）は行き先として正しい */
    check(v.href === "/" || !v.href.endsWith("/"),
      `${k}: 講座が無くても、開ける住所になる`, v.href);
  }

  /* 知らない字（古い版が残した行）でも落とさない */
  const un = noticeView({ kind: "むかしの字" });
  check(un.href === "/", "知らない種類でもホームへ落とす", un.href);
  check(un.t.length > 0, "知らない種類でも見出しは出す");
  check(!isNoticeKind("むかしの字"), "知らない字は種類ではない");
  check(NOTICE_KINDS.every((k) => isNoticeKind(k)), "並べた種類は全部が種類");
}

console.log("\n── 講座が要る種類 ──");
{
  /* 討議・修了証まわりは、どの講座の話か分からないと開けない */
  for (const k of ["slot", "room", "pass", "issue_ng"] as NoticeKind[]) {
    check(needsCourse(k), `${k}: 講座が要る`);
    check(noticeView({ kind: k, courseId: "shokucho" }).href.includes("shokucho"),
      `${k}: 講座の画面へ飛ぶ`, noticeView({ kind: k, courseId: "shokucho" }).href);
  }
  for (const k of ["member_ok", "member_ng", "seat", "train"] as NoticeKind[]) {
    check(!needsCourse(k), `${k}: 講座は要らない`);
  }
  /* 討議の入り口と、修了証は別の画面。混ぜると、
     日を選ぶつもりで討議の部屋に入ることになる */
  check(noticeView({ kind: "room", courseId: "x" }).href.endsWith("/talk"), "討議は討議の画面へ");
  check(noticeView({ kind: "slot", courseId: "x" }).href.endsWith("/cert"), "候補日は発行の画面へ");
}

console.log("\n── 添える一言 ──");
{
  /* 断った理由。これを落とすと、受け取った人が次にどうすればいいか
     分からない「断られました」だけが残る */
  check(noteOf("  日程が合いません  ") === "日程が合いません", "前後の空白は落とす");
  check(noteOf(null) === "", "無くても落ちない");
  check(noteOf(undefined) === "", "未定義でも落ちない");
  check(noteOf("あ".repeat(2000)).length === 1000, "長すぎるものは切る");

  const ui = code("src/components/Notices.tsx");
  check(ui.includes('data-testid="notice-note"'), "一言を画面に出す");
  check(ui.includes("{n.note}"), "そのまま字として出す（作り込まない）");
  /* HTML として流し込むと、書いた字がそのまま画面の作りになる */
  check(!ui.includes("dangerouslySetInnerHTML"), "HTML としては流し込まない");
}

console.log("\n── 誰に届くか ──");
{
  /* 宛先はログインしている本人で決める。画面から受け取ると、
     他人の user_id を書いて、よその人の知らせが読める */
  const api = code("src/app/api/notices/route.ts");
  check(api.includes("currentUser"), "誰かはサーバで決める");
  check(api.includes('.eq("user_id", user.id)'), "自分あてだけを読む");
  check(!/userId\s*=\s*b\./.test(api), "画面から宛先を受け取らない");
  check(!api.includes("currentOwner") && !api.includes("currentAdmin"),
    "本部や担当者の道は置かない（本人あての返事）");
  /* 書き込む道を開けると、自分あてに「許可されました」を作れる */
  check(!api.includes('.insert('), "画面からは知らせを作れない");
  check(api.includes('b.action !== "read"'), "できるのは読んだ印だけ");

  const sql = read("supabase/migrations/0024_notice.sql");
  check(/for select using \(user_id = auth\.uid\(\)\)/.test(sql), "読めるのは本人だけ（RLS）");
  check(!/create policy .*notices.* for insert/i.test(sql), "画面からの insert は許さない");
  check(!/create policy .*notices.* for update/i.test(sql), "画面からの update は許さない");
  check(/grant execute on function public\.add_notice[\s\S]*?to service_role/.test(sql),
    "作れるのはサーバだけ");
  check(/revoke all on function public\.add_notice[\s\S]*?from public, anon, authenticated/.test(sql),
    "作る関数を、ログインした人から取り上げてある");
}

console.log("\n── 返事のたびに残す ──");
{
  /* こちらが手を動かして、相手が待っていることが動いたら、必ず残す。
     1つでも抜けると、そこだけ伝わらない */
  const want: { p: string; k: NoticeKind; why: string }[] = [
    { p: "src/app/api/admin/member/route.ts", k: "member_ok", why: "参加申込を許可した" },
    { p: "src/app/api/admin/member/route.ts", k: "member_ng", why: "参加申込を断った" },
    { p: "src/app/api/admin/cert/route.ts", k: "cert", why: "修了証を出した" },
    { p: "src/app/api/owner/orders/route.ts", k: "seat", why: "入金を確認して受講コードを出した" },
    { p: "src/app/api/owner/orders/route.ts", k: "train", why: "個人の入金を確認した" },
    { p: "src/app/api/owner/training/route.ts", k: "train", why: "実務トレーニングを付けた" },
    { p: "src/app/api/owner/issue/route.ts", k: "slot", why: "討議の候補日を出した" },
    { p: "src/app/api/owner/issue/route.ts", k: "room", why: "討議の入り口が決まった" },
    { p: "src/app/api/owner/issue/route.ts", k: "pass", why: "討議・実技を通した" },
    { p: "src/app/api/owner/issue/route.ts", k: "issue_ng", why: "発行申請を断った" },
  ];
  for (const w of want) {
    const c = code(w.p);
    check(c.includes(`"${w.k}"`), `${w.why} → ${w.k}`, w.p);
  }
  /* 並べた種類が全部どこかで使われていること。
     使われない種類は、作ったつもりで繋いでいない印 */
  const all = want.map((w) => w.k);
  for (const k of NOTICE_KINDS) {
    check(all.includes(k), `${k} を残す所がある`);
  }

  /* 取り消しでは出さない。こちらから一言あるべき話なので、
     知らせだけが先に届くほうが困る */
  const cert = code("src/app/api/admin/cert/route.ts");
  const rev = cert.slice(cert.indexOf('action === "revoke"'), cert.indexOf('action === "revoke"') + 400);
  check(!rev.includes("addNotice"), "修了証の取り消しでは残さない");
}

console.log("\n── 残せなくても、返事は通す ──");
{
  /* 知らせが書けないから許可が出せない、では本末転倒 */
  const s = code("src/lib/notice.server.ts");
  check(s.includes("try {") && s.includes("catch"), "失敗を受け止める");
  check(!/throw /.test(s), "投げない");
  check(s.includes('import "server-only"'), "サーバだけで動く");
  /* 呼ぶ側が、返り値で分岐していないこと（分岐すると返事が止まる） */
  for (const p of [
    "src/app/api/admin/member/route.ts",
    "src/app/api/owner/issue/route.ts",
    "src/app/api/owner/orders/route.ts",
  ]) {
    const c = code(p);
    check(!/if\s*\(\s*!?\s*await addNotice/.test(c), `${p}: 残せたかで分岐しない`);
  }
}

console.log("\n── ホームの出し方 ──");
{
  const page = code("src/app/page.tsx");
  check(page.includes("<Notices"), "ホームに出している");
  /* 返事は、待っている人がいちばん先に見る所へ */
  check(page.indexOf("<Notices") < page.indexOf("<FirstSteps"), "はじめかたより上に出す");

  const ui = code("src/components/Notices.tsx");
  check(ui.includes("if (!rows.length) return null"), "1件も無ければ枠ごと出さない");
  check(ui.includes('data-testid="notices-unread"'), "未読の数を出す");
  check(ui.includes('action: "read"'), "開いたら読んだ印を付ける");
  /* 1件ずつ押させると、押し忘れた1件で数字が消えなくなる */
  check(!/id:\s*n\.id[\s\S]{0,80}action:\s*"read"/.test(ui), "1件ずつは押させない");
  /* その場で数字と印を消すと、届いた回に限って、どれが新しいか分からない。
     覚えるのはサーバだけ。画面は次に開いたときに変わる */
  check(!/setUnread\(0\)/.test(ui), "開いても、その場では数字を消さない");
  check(!/read:\s*true/.test(ui), "開いても、その場では既読の形にしない");
  check(ui.includes("sent"), "読んだ印を二度送らない");
  check(ui.includes("cache: \"no-store\""), "作り置きを読まない（届いた知らせが出ない）");
}

console.log("\n── 古いものは捨てる ──");
{
  /* 知らせは記録ではない。受けた記録は enrollments と certificates に残る */
  const sql = read("supabase/migrations/0024_notice.sql");
  check(/sweep_notices/.test(sql), "捨てる手がある");
  check(/create index[\s\S]*?notices_unread_idx/.test(sql), "未読を数える索引がある");
  check(/on delete cascade/.test(sql), "人が消えたら知らせも消える");
}

console.log("\n── 素の PostgreSQL で当てる分 ──");
{
  /* SQL でしか確かめられないこと（押し直しの窓、読んだ印の届く範囲、
     ログインした人から作れないこと）は、こちらに置いてある。
     置き忘れると、ここの決まりは誰も確かめないままになる */
  const sql = read("supabase/tests/notices.sql");
  check(sql.includes("add_notice"), "足す所を当てている");
  check(sql.includes("read_notices"), "読んだ印を当てている");
  check(sql.includes("sweep_notices"), "捨てる所を当てている");
  check(sql.includes("has_function_privilege"), "誰が作れるかを当てている");
  const doc = read("supabase/tests/README.md");
  check(doc.includes("notices.sql"), "流し方が書いてある");
}

console.log("\n── 版 ──");
{
  const dir = readdirSync(new URL("../supabase/migrations", import.meta.url));
  const last = dir.filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort().at(-1) ?? "";
  check(last.startsWith("0024"), `いちばん新しいのが 0024（${last}）`);
  const gen = read("src/content/schema.ts");
  check(gen.includes('"0024"'), "必要な版が書き出されている");
  const all = read("supabase/apply-all.sql");
  check(all.includes("add_notice"), "apply-all.sql にも入っている");
}

console.log("\n── まとめ ──");
console.log(`${ok} 件通過 / ${ng} 件失敗`);
if (ng) process.exit(1);
