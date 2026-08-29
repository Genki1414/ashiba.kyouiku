/* 画面が読む項目を、返す側が本当に返しているかの試験。
   実行: npx tsx tests/api-shape.mts

   なぜ要るか。
   教育担当者の画面で「参加の申し込み」が出ないことがあった。
   問い合わせは合っていて、返す所が2つに分かれていたのが原因。
   名簿が空のときの返しには requests が入っていて、
   人が1人でも居るときの返しには入っていなかった。
   受講者が1人居る会社では、申し込みが**絶対に出ない**形になっていた。

   型では捕まらない。fetch の戻りは any で、画面は j.requests ?? [] と
   受けているので、抜けていても 0件 として静かに出る。
   だから、書いてある字を突き合わせて見る。 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { COURSES } from "@/content/courses";
import { DEFAULT_COURSE_PRICE } from "@/lib/pricing";

let ok = 0;
let ng = 0;
const check = (c: boolean, m: string) => { if (c) ok++; else { ng++; console.error("NG:", m); } };

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/* { … } の中を、対応する括弧まで取り出す */
const body = (src: string, from: number) => {
  let d = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(from, i + 1); }
  }
  return "";
};

/* NextResponse.json({ … }) のうち、ok: true を返しているもの */
const successBodies = (src: string) => {
  const out: string[] = [];
  const re = /NextResponse\.json\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const b = body(src, src.indexOf("{", m.index));
    if (/\bok:\s*true\b/.test(b) || /\.\.\.base\b/.test(b)) out.push(b);
  }
  return out;
};

/* いちばん外側にある「key:」と「...展開」を拾う。
   注釈（コメント）は先に落とす。落とさないと、
   項目の手前に注釈が付いているだけで、その項目を見落とす */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const keysOf = (b: string) => {
  const inner = strip(b.slice(1, -1));
  const keys = new Set<string>();
  let d = 0;
  let line = "";
  const flush = () => {
    const m = /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)\s*(:|,|$)/.exec(line);
    if (m) keys.add(m[1]);
    line = "";
  };
  for (const ch of inner) {
    if (ch === "{" || ch === "[" || ch === "(") d++;
    if (ch === "}" || ch === "]" || ch === ")") d--;
    if (ch === "," && d === 0) { flush(); continue; }
    line += ch;
  }
  flush();
  return keys;
};

console.log("── /api/admin/summary が返す形 ──");
{
  const src = read("src/app/api/admin/summary/route.ts");
  const bodies = successBodies(src);
  check(bodies.length >= 2, `うまくいったときの返しが2つ以上ある（いま ${bodies.length}）`);

  /* base に集めた分を、それぞれの返しに足して見る */
  const baseMatch = /const base = \{/.exec(src);
  const baseKeys = baseMatch ? keysOf(body(src, src.indexOf("{", baseMatch.index))) : new Set<string>();
  check(baseKeys.size > 0, "共通の形（base）が置いてある");

  const sets = bodies.map((b) => {
    const k = keysOf(b);
    if (k.has("base")) for (const x of baseKeys) k.add(x);
    k.delete("base");
    return k;
  });

  /* 画面が読む項目 */
  const client = read("src/app/admin/AdminClient.tsx");
  const load = client.slice(client.indexOf("const load ="), client.indexOf("const load =") + 1600);
  const wants = new Set<string>();
  for (const m of load.matchAll(/\bj\.([A-Za-z_$][\w$]*)/g)) wants.add(m[1]);
  /* うまくいかなかったときだけのもの */
  for (const x of ["canSetup", "reason", "signedIn", "ok"]) wants.delete(x);
  check(wants.size >= 8, `画面が読む項目を拾えている（いま ${[...wants].join(" ")}）`);

  for (const want of [...wants].sort()) {
    for (let i = 0; i < sets.length; i++) {
      check(sets[i].has(want), `${want} が ${i + 1}つめの返しに入っている`);
    }
  }

  /* 返しどうしで食い違っていないか（片方にだけ足した、を捕まえる） */
  for (let i = 1; i < sets.length; i++) {
    const a = sets[0];
    const b = sets[i];
    const miss = [...a].filter((k) => !b.has(k)).concat([...b].filter((k) => !a.has(k)));
    check(!miss.length, `返しどうしで項目が揃っている（食い違い: ${miss.join(" ")}）`);
  }
}

console.log("── 元帳を返す2か所 ──");
{
  /* 本部と、その会社の担当者。同じものを見せる。
     どちらかで組み立て直すと、片方に足した項目がもう片方から抜ける */
  for (const p of ["src/app/api/owner/ledger/route.ts", "src/app/api/admin/past/route.ts"]) {
    const src = read(p);
    check(/companyRecords\(/.test(src), `${p} は共通の組み立てを使う`);
    check(!/\.from\("progress"\)/.test(src), `${p} は受講の中身を自分で引き直さない`);
  }
  /* よその事業者を指せる道を作らない。
     担当者側が事業者の番号を外から受け取ると、書き換えて
     よその会社の記録を引ける。受け取らないことを、字で見る */
  const past = read("src/app/api/admin/past/route.ts");
  check(!/searchParams/.test(past), "担当者側は URL から事業者を受け取らない");
  check(/export async function GET\(\)/.test(past), "担当者側の GET は引数を取らない");
  check(!/export async function POST/.test(past), "担当者側は読むだけ（POST を持たない）");
  check(/currentAdmin\(\)/.test(past), "担当者側は currentAdmin() で事業者を決める");
  check(
    /companyRecords\(supabase, admin\.companyId\)/.test(past),
    "担当者側は自分の事業者ぶんだけを引く",
  );
}

console.log("── 担当者が触れる範囲 ──");
{
  /* 「自社ぶんだけ」を、どの列で見ているか。
     人の側（users.company_id）で見ると、辞めた人・移った人でずれる */
  const cert = read("src/app/api/admin/cert/route.ts");
  check(/company_id.*\)\s*$|select\("id, user_id, course_id, company_id"\)/m.test(cert)
        || cert.includes('"id, user_id, course_id, company_id"'),
    "修了証は、受講が持つ会社を読む");
  check(/ownerCompany !== admin\.companyId/.test(cert),
    "修了証は、受けさせた会社と突き合わせる");

  const summary = read("src/app/api/admin/summary/route.ts");
  for (const t of ["memberships", "enrollments"]) {
    const at = summary.indexOf(`.from("${t}")`);
    check(at > 0 && summary.slice(at, at + 400).includes("admin.companyId"),
      `名簿の ${t} は自社で絞る`);
  }
}

console.log("── 新しく登録した人の、会社との紐付け ──");
{
  /* 申し込んだ人に「会社とつなぐ」と出し続けると、
     押しても同じ画面に戻るだけで、進んだのかどうか分からない */
  const t = read("src/lib/tenant.ts");
  check(/MemberState/.test(t), "紐付けの状態に、3つの言い方がある");
  check(/"pending"/.test(t), "許可待ちを、まだの人と分けている");
  check(/approved_at/.test(t) && /left_at/.test(t), "在籍は、許可が下りていて抜けていないこと");

  const me = read("src/app/api/me/route.ts");
  check(/member/.test(me), "ホームに、紐付けの状態を返す");

  const home = read("src/components/HomeCards.tsx");
  check(/home-pending/.test(home), "許可待ちの札がある");
  check(/me\.member === "none"/.test(home), "まだの人にだけ「会社とつなぐ」を出す");
  check(/me\.member === "active"/.test(home),
    "受講コードの札は、在籍している人にだけ出す");

  /* 受講コード（席）は学科のもの。実務トレーニングは別の売り物で、
     第1章はコード無しで遊べる。ここを「学科と実務トレーニング」と
     書いてあると、読んだ人が第1章も金を払わないと出来ないと思う */
  check(!/学科と実務トレーニング/.test(home),
    "ホームの札は、受講コードを学科のものとして書いている");
  const seat = read("src/components/NeedSeat.tsx");
  check(!/学科と実務トレーニング/.test(seat),
    "断りの画面も、受講コードを学科のものとして書いている");
  check(/need-seat-train/.test(seat),
    "断ったままにせず、第1章へ行ける");
}

console.log("── 個人の申し込みと請求書 ──");
{
  /* 教育担当者を通さずに、本人が買える。
     個人宛の請求書を出せないと、経費で落とす人が買えない */
  const api = read("src/app/api/train-order/route.ts");
  check(!/currentAdmin/.test(api), "教育担当者でなくても申し込める");
  check(/currentUser\(\)/.test(api), "本人として申し込む");
  check(/trainPrice\(\)/.test(api), "金額はサーバで出す");
  check(!/b\.amount|body\.amount/.test(api), "画面から送られてきた金額は見ない");
  /* もう使える人には売らない。二重に払わせない */
  check(/may\.ok/.test(api), "もう開いている人には売らない");
  /* 押すたびに注文が増えると、どれを払えばよいか分からなくなる */
  check(/status", "pending"|eq\("status", "pending"\)/.test(api),
    "払っていない申し込みが残っていれば、それを返す");
  check(/bill_to/.test(api), "請求書の宛名を受け取る");

  const sql = read("supabase/migrations/0018_solo.sql");
  check(/orders_owner_one/.test(sql), "注文は、会社のものか個人のものかどちらか");
  check(/orders_seat_is_company/.test(sql), "受講コードは会社しか買えない");
  check(/pay_solo_order/.test(sql), "入金と利用権を、ひとつの手で立てる");

  /* 入金を立てるのと利用権を付けるのを分けると、
     片方だけ通ったときに「払ったのに開かない」が起きる */
  const owner = read("src/app/api/owner/orders/route.ts");
  check(/pay_solo_order/.test(owner), "個人の注文は、入金と同時に利用権が付く");

  const inv = read("src/app/api/owner/invoice/route.ts");
  check(/currentOwner\(\)/.test(inv), "請求書を出せるのは本部だけ");
  check(/invoiceNo/.test(inv), "登録番号を載せる");
  check(/TAX_RATE/.test(inv), "税を割り戻す（注文の金額と食い違わせない）");
}

console.log("── 会社の登録 ──");
{
  /* 同じ会社が2つ登録されると、名簿が割れる。
     片方に申し込んだ人が、もう片方を見ている担当者からは見えない */
  const api = read("src/app/api/admin/setup/route.ts");
  check(/sameCompany/.test(api), "作る前に、同じ会社がないか見る");
  check(/exists/.test(api), "あれば、作らずに「申し込んでください」と返す");
  check(/likeCompany/.test(api), "似た名前も探す");
  check(/maybe/.test(api), "似た名前は候補として返す");
  /* 前株と後株は別の会社のことがある。止めはしない */
  check(/body\.force/.test(api), "似ているだけなら、押し直せば作れる");
  check(/409/.test(api), "断るときは、理由の分かる断り方をする");
  check(/me\.company_id/.test(api), "すでにどこかに属している人は作れない");

  /* 受講者の側からも登録できる。/admin まで行かないと作れないと、
     新しい会社が自分で使い始められない */
  const join = read("src/app/join/JoinClient.tsx");
  check(/join-new-go/.test(join), "会社とつなぐ画面から登録できる");
  check(/join-maybe/.test(join), "似た名前が出たら、そこから申し込める");
  check(/join-new-force/.test(join), "どれとも違うときは、そのまま登録できる");
}

console.log("── 実務トレーニングの関門 ──");
{
  /* 第1章は誰でも（試し）。第2章から先は利用権を持っている人だけ。
     画面を隠すのではなく、サーバで止めて中身を作らない。
     作ってしまうと、手順がそのまま返ってしまう */
  for (const p of [
    "src/app/training/ch2/page.tsx",
    "src/app/training/ch3/page.tsx",
    "src/app/training/demo/ch2/page.tsx",
    "src/app/training/demo/ch3/page.tsx",
  ]) {
    const src = read(p);
    check(/await canTrain\(\)/.test(src), `${p.split("/").slice(-2).join("/")} で止める`);
    check(/NeedTrain/.test(src), `${p.split("/").slice(-2).join("/")} は理由を出す`);
  }

  /* 第1章は止めない。止めたら試しにならない。
     canTrain を読むこと自体は構わない（通し終えた画面に
     「つぎは第2章」を出すかどうかを決めるのに要る）。
     だめなのは、その答えで**中身を作らない**こと */
  const ch1 = read("src/app/training/ch1/page.tsx");
  check(!/NeedTrain/.test(ch1), "第1章は止めない（誰でも遊べる）");
  check(!/if\s*\(!may\.ok\)\s*return/.test(ch1),
    "第1章は、開いていない人にも中身を作る");

  const gate = read("src/lib/trainingGate.ts");
  check(/FREE_CHAPTERS = \["ch1"\]/.test(gate), "誰でも遊べるのは第1章だけ");
  check(/training_access/.test(gate), "利用権を見る");
  check(/approved_at/.test(gate), "無償利用は在籍で見る（申し込んだだけは通さない）");

  /* 学科とは別の売り物。席では開かない */
  check(!/seats/.test(gate), "学科の席では開かない（別の売り物）");

  const api = read("src/app/api/owner/training/route.ts");
  check(/currentOwner\(\)/.test(api), "利用権を付けられるのは本部だけ");
  check(/revoke_training/.test(api), "取り消せる");

  const sql = read("supabase/migrations/0017_train.sql");
  check(/on conflict \(user_id\) do update/.test(sql), "何度押しても増えない");
  check(!/delete from public\.training_attempts/.test(sql), "取り消しても、遊んだ記録は消さない");
}

console.log("── 3年たった記録 ──");
{
  /* 決まりの記録を、気づかないうちに消してはいけない */
  const api = read("src/app/api/owner/retention/route.ts");
  check(/currentOwner\(\)/.test(api), "触れるのは本部だけ");
  check(!/deleteMany|for \(const/.test(api), "まとめて消す道を作らない");
  /* 画面が古いまま押されることがある。消す直前にもう一度確かめる */
  const posts = api.slice(api.indexOf("export async function POST"));
  check(/erasable\(supabase\)/.test(posts), "消す直前に、もう一度確かめる");
  check(/409/.test(posts), "消せない相手は、理由の分かる断り方をする");

  const sql = read("supabase/migrations/0016_keep3y.sql");
  check(/approved_at is not null/.test(sql), "在籍している人は、押しても消せない");
  check(/delete from public\.verify_logs/.test(sql), "顔の照合の記録は消す");
  check(/delete from public\.held_quals/.test(sql), "自己申告の資格も消す");
  /* 受講の記録と修了証は残す。番号で照会されるため */
  check(!/delete from public\.enrollments/.test(sql), "受講の記録は消さない");
  check(!/delete from public\.certificates/.test(sql), "修了証は消さない");
  check(!/delete from public\.progress/.test(sql), "視聴記録も消さない");
  check(/erased_at/.test(sql), "いつ消したかを残す（二重に数えない）");

  const lib = read("src/lib/retention.ts");
  check(/KEEP_YEARS = 3/.test(lib), "保存は3年（安衛則 第38条）");
  check(/staying\.has/.test(lib), "在籍している人は出さない");
  check(/v\.last > border/.test(lib), "1件でも新しければ出さない");
}

console.log("── 修了試験の合言葉 ──");
{
  /* 仮の合言葉は、このまま公開の置き場に載っている（誰でも読める）。
     本番でそれを使うと、受けていない人でも合格の札を作れてしまう */
  const src = read("src/app/api/exam/route.ts");
  check(/DEV_SECRET/.test(src), "仮の合言葉に名前が付いている");
  check(/process\.env\.VERCEL/.test(src), "本番かどうかを見ている");
  check(/UNSAFE/.test(src), "本番で仮の合言葉なら、印を立てる");
  /* 出すのも採点も、両方止める。片方だけだと素通りする */
  const stops = (src.match(/if \(UNSAFE\) return unsafe\(\);/g) ?? []).length;
  check(stops === 2, `出題と採点の両方で止める（いま ${stops}か所）`);
  check(/503/.test(src), "止めるときは、理由の分かる断り方をする");
}

console.log("── データベースの版 ──");
{
  /* 手で書いていたら 0010 のまま止まっていて、
     0011〜0015 を流していない人にも「大丈夫」と出ていた。
     いまは npm run build:sql が書き出す */
  const gen = read("src/content/schema.ts");
  const m = /NEED_SCHEMA = "(\d{4})"/.exec(gen);
  check(!!m, `必要な版が書き出されている（${m?.[1]}）`);

  const dir = readdirSync(new URL("../supabase/migrations", import.meta.url));
  const last = dir.filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort().at(-1) ?? "";
  check(m?.[1] === last.slice(0, 4), `いちばん新しいマイグレーションと合う（${m?.[1]} ／ ${last}）`);
  check(/手で書かないこと/.test(gen), "手で書かない、と書いてある");

  /* 版を上げたマイグレーションは、必ず schema_version も上げる */
  const sql = readFileSync(new URL(`../supabase/migrations/${last}`, import.meta.url), "utf8");
  check(
    new RegExp(`select '${last.slice(0, 4)}'`).test(sql),
    `${last} が schema_version を上げている`,
  );

  /* まとめたファイルにも、その版が入っている */
  const all = read("supabase/apply-all.sql");
  check(
    new RegExp(`select '${last.slice(0, 4)}'`).test(all),
    "apply-all.sql にも入っている（build:sql を流し忘れていない）",
  );

  const health = read("src/app/api/health/route.ts");
  check(/from "@\/content\/schema"/.test(health), "つながり具合の確認は、書き出した版を見る");
  check(!/NEED_SCHEMA = "/.test(health), "つながり具合の確認に、版を手で書いていない");
}

console.log("── 講座ごとの値段 ──");
{
  /* 単価はサーバだけが読む。画面で読むと、見せている金額と
     実際に請求する金額が食い違う */
  const srv = read("src/lib/price.server.ts");
  check(/^import "server-only"/m.test(srv), "単価を読むところは server-only");

  /* コメントを外してから見る。注意書きに process.env と書いてあるだけで
     引っかかると、直しようがない */
  const code = (p: string) =>
    read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  check(!/process\.env/.test(code("src/lib/pricing.ts")), "決め方の側は環境変数を読まない");

  /* 画面（"use client"）から、単価を読むところを読み込んでいないこと */
  const dir = (p: string): string[] => {
    const out: string[] = [];
    for (const e of readdirSync(new URL(`../${p}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) out.push(...dir(`${p}/${e.name}`));
      else if (/\.tsx?$/.test(e.name)) out.push(`${p}/${e.name}`);
    }
    return out;
  };
  const clients = dir("src").filter((f) => /^"use client"|^'use client'/m.test(read(f)));
  const leak = clients.filter((f) => /from\s+["'][^"']*price\.server/.test(code(f)));
  check(leak.length === 0, "画面から単価を読み込んでいない", leak.join(","));

  /* 申込みの画面は、講座ごとの単価をサーバから受け取ること */
  const order = read("src/app/api/order/route.ts");
  check(/unitPrice\(course\.id\)/.test(order), "請求する金額は、選んだ講座の単価で立てる");
  check(/unitPrice: unitPrice\(c\.id\)/.test(order), "講座ごとの単価を画面へ返す");
  const oc = read("src/app/order/OrderClient.tsx");
  check(
    /courses\.find\(\(c\) => c\.id === courseId\)\?\.unitPrice/.test(oc),
    "画面は、選んでいる講座の単価で計算する",
  );

  /* 特商法の表記には、売っている講座を全部載せる */
  const legal = read("src/app/legal/tokushoho/page.tsx");
  check(/allPrices\(\)/.test(legal), "特商法の表記に、全講座の値段を載せる");
}

console.log("── 修了証の発行申請 ──");
{
  /* 学科のあとに討議や実技が残る講座は、押した瞬間に紙を出さない。
     ここが崩れると、まだ修了していない人に修了証が出る */
  const cert = read("src/app/api/cert/route.ts");
  check(/gateOf\(/.test(cert), "修了証は、講座の関門を見ている");
  check(/gateReason\(/.test(cert), "関門が通っていない理由を、そのまま断りに使う");
  check(/eligible\(\{[^}]*gate/s.test(cert), "関門を判定に渡している");

  const lib = read("src/lib/cert.ts");
  check(/gate\?\.reason/.test(lib), "関門が残っていれば、修了証を出さない");

  /* 候補日を出すのは本部だけ。受講する人には作らせない */
  const mine = read("src/app/api/issue/route.ts");
  check(!/offer_slots/.test(mine), "受講する人の側から、候補日は作れない");
  check(!/clear_request/.test(mine), "受講する人の側から、自分を修了にできない");
  check(/canRequest\(/.test(mine), "学科が終わるまで申請を受けない");

  const own = read("src/app/api/owner/issue/route.ts");
  check(/currentOwner\(/.test(own), "本部かどうかを見ている");
  check(/checkSlots\(/.test(own), "出す候補日を、先に検査している");

  /* 申請から作った回を、みんなの一覧に出さない
     （一人で受けている人の討議に、よその人が申し込める） */
  const live = read("src/lib/liveQuery.ts");
  check(/by_request/.test(live), "申請から作った回に印が付いている");
  check(/\.eq\("by_request", false\)/.test(live), "申し込みの一覧からは外している");

  /* 書き込みのポリシーを置かない（＝画面から直接は書けない） */
  const sql = read("supabase/migrations/0023_issue.sql");
  /* create policy … for insert / update が無いこと。
     行ロックの for update とは別物なので、policy の文だけを見る */
  const policies = [...sql.matchAll(/create policy[\s\S]*?for (\w+)/g)].map((m) => m[1]);
  check(policies.length > 0, "select のポリシーは置いてある");
  check(
    policies.every((p) => p === "select"),
    "申請の表に、書き込みのポリシーを置いていない",
    policies.join(","),
  );
  check(/security definer/.test(sql), "状態を進めるのは関数だけ");
  check(
    /revoke all on function public\.pick_slot/.test(sql),
    "関数は service_role だけが呼べる",
  );
}

console.log("── 取得済みの資格 ──");
{
  /* 自己申告と「会社が確かめた」は分ける。
     自分で確かめたことにできると、印の意味が無くなる */
  const mine = read("src/app/api/quals/route.ts");
  check(!/confirm/i.test(mine), "本人の側は、確認済みを立てられない");
  check(/user\.id/.test(mine) && !/searchParams/.test(mine),
    "本人の側は、自分の id しか使わない");

  const adm = read("src/app/api/admin/qual/route.ts");
  check(/currentAdmin\(\)/.test(adm), "確認は教育担当者だけ");
  check(/admin\.companyId/.test(adm), "会社はログインから決める（画面から受け取らない）");
  check(!/\bcompanyId:\s*b\./.test(adm), "会社を本文から受け取らない");

  /* 在籍を数えてから立てる。よその会社が勝手な裏書きを付けられない */
  const sql = read("supabase/migrations/0015_qual.sql");
  check(/memberships/.test(sql) && /approved_at is not null/.test(sql),
    "確認は、在籍している人のぶんだけ");
  check(/confirmed_at = null/.test(sql),
    "中身を直したら、確認済みは落ちる");

  /* まとめて選べる。同じ所で同じ日に何枚も取ることが多い */
  check(/qualIds/.test(mine), "まとめて足せる（複数選択）");
  check(/40/.test(mine), "一度に足せる数に上限がある");

  /* 申請は担当者の画面の上に出す。出さないと埋もれる */
  const sum = read("src/app/api/admin/summary/route.ts");
  check(/quals/.test(sum), "名簿の返しに、資格の申請が入る");
  check(/!h\.confirmedAt/.test(sum), "申請は、まだ確かめていないものだけ");
  const cli = read("src/app/admin/AdminClient.tsx");
  check(/admin-qual-reqs/.test(cli), "担当者の画面に、資格の申請のまとまりがある");
}

console.log("── 修了証の名義 ──");
{
  /* 名義は東北三上機材で固定。受講する会社の名前は載せない。
     載せると、特別教育を実施していない会社の名前で紙が出てしまう */
  const src = read("src/app/api/cert/route.ts");
  check(/company:\s*issuerName\(\)/.test(src), "修了証の事業者名は issuerName() から取る");
  check(/responsible:\s*issuerResponsible\(\)/.test(src), "責任者も同じところから取る");
  check(!/company:\s*(admin\.|co\.|.*companyName)/.test(src),
    "受講者の会社名を事業者名として載せていない");
}

console.log("── /api/member が返す形 ──");
{
  /* 受講者側。state が3つとも返っていないと、許可待ちが出ない */
  const src = read("src/app/api/member/route.ts");
  for (const s of ["none", "active", "pending"]) {
    check(src.includes(`state: "${s}"`), `state: "${s}" を返している`);
  }
  check(/\bpending:\s*rows\.map/.test(src), "許可待ちは、開いている申し込みを並べて返す");
}

console.log("── 単元IDの渡し方 ──");
{
  /* 0011 で単元IDに講座が付いて「ashiba:1-1」になった。
     /setup の点検だけ「1-1」のままになっていて、外部キーで弾かれ、
     設定は正しいのに「初期化が未完了」と赤く出ていた。
     いちばん困る出方をするので、決め打ちを二度と入れない */
  const files = ["progress", "quiz", "health"].map(
    (n) => [n, read(`src/app/api/${n}/route.ts`)] as const,
  );
  for (const [n, src] of files) {
    check(!/p_lesson_id:\s*["'`]/.test(src),
      `/api/${n} は、単元IDを字で書いていない`);
  }
  const health = read("src/app/api/health/route.ts");
  check(/from\("lessons"\)/.test(health),
    "/setup の点検は、試す単元を lessons 表からもらう");
  check(/course_id/.test(health),
    "その単元は、いま見ている講座のもの");
}

console.log("── 第1章のあとの案内 ──");
{
  /* 第1章を通した直後がいちばん気持ちが乗っている。
     ここで案内しないと、章の一覧に戻って灰色の札を見るまで
     次があることに気づかない */
  const page1 = read("src/app/training/ch1/page.tsx");
  check(/canTrain\(\)/.test(page1), "第1章の頁で、第2章が開いているかをサーバで見る");
  check(/nextLocked=\{!may\.ok\}/.test(page1), "その答えを結果の画面まで渡す");

  const res = read("src/components/training/Result.tsx");
  check(/next && pass &&/.test(res),
    "つぎの章の案内は、合格したときだけ出す");
  check(/result-next-locked/.test(res) && /href="\/train"/.test(res),
    "開いていない人には、申し込みへの入口を出す");
  /* 単価はサーバだけが読む。画面で読むと仮の値になり、
     見せている額と請求する額が食い違う */
  check(!/price\.server|unitPrice|DEFAULT_UNIT_PRICE|円/.test(strip(res)),
    "結果の画面で金額を出さない（額は /train がサーバから受け取って出す）");
}

console.log("── 無償利用の切り替え ──");
{
  /* 押した瞬間に切り替わると、その会社の在籍者は受講コードなしでは
     学科を開けなくなり、受講中の人もその場で止まる。
     試しに切り替えて戻し忘れると、現場が止まる */
  const led = read("src/app/owner/LedgerClient.tsx");
  check(/owner-trial-ask/.test(led), "切り替える前に確認を出す");
  check(/owner-trial-yes/.test(led), "確認のうえで押す所が分かれている");
  check(/setAsk\(ask === c\.id \? null : c\.id\)/.test(led),
    "札を押しただけでは切り替わらない");
  check(/c\.active/.test(strip(led)) && /受講コードを引き換えていないと/.test(led),
    "何人が影響を受けるかを出す");

  /* 切り替えられるのは本部だけ。担当者が自分の会社を無償にできたら
     いくらでもタダで使える */
  const api = read("src/app/api/owner/orders/route.ts");
  check(/currentOwner\(\)/.test(api), "無償利用を切り替えられるのは本部だけ");
}

console.log("── 解説の画面 ──");
{
  /* 50分のあいだ字幕を1行ずつ見ているだけ、というのが直したかったこと */
  const nv = read("src/components/edu/NarrationView.tsx");
  check(/NarrationFigure/.test(nv), "解説の横に図解を出す");
  check(/figureAt\(/.test(nv), "どの図解かは、いま何行目かで決める");

  /* 聞きながら11回タップさせるのは仕事が増えるだけだし、
     そこで答えを見てしまうと、あとの図解の段が答え合わせにならない */
  const nf = read("src/components/edu/NarrationFigure.tsx");
  check(!/FigureRenderer/.test(nf),
    "解説の横では、図解の部品（タップして開く・間違い探し）を使わない");
  check(/onDone/.test(nf) === false, "見せるだけで、やり終えたことにしない");

  /* いま読んでいるところを光らせる。
     ただし当てられるのは、台本がその名前をそのまま言っているときだけ。
     ゆるく切ると「建地の間隔は」が「床材と建地とのすき間」に当たる。
     違う所が光るのは、光らないより悪い */
  check(/hitRow/.test(nf), "読んでいる行が名指ししていれば、その行を光らせる");
  check(!/split\("の"\)/.test(nf), "「の」で切って当てにいかない（誤爆する）");
  check(/narr-mark/.test(nv), "字幕の中でも、同じ語を光らせる");

  /* 下に図解を置いたら、図解を見るために下ろすと字幕が消え、
     字幕を見るために戻すと図解が消える、という往復になった */
  check(/sticky top-0/.test(nv), "字幕と操作は、画面の上に貼り付ける");
  check(/scrollIntoView/.test(nf), "光った行は、画面の中に入れる");
  check(/block: "nearest"/.test(nf), "もう見えているときは動かさない");

  /* 名前が出てこなくても、言っていることが同じなら当てる */
  check(/hitByName/.test(nf), "名前で当たるぶんは、いちばん確かなので先に見る");
  check(/gramsOf/.test(nf), "言い換えでも当てにいく");

  /* 6時間ぶん聞くもの。端末に入っている順に取ると古い機械声が先に来る */
  const au = read("src/lib/audio.ts");
  check(/VOICE_RANK/.test(au), "日本語の声のうち、人らしいものを選ぶ");
  check(/natural\|neural\|online/i.test(au), "新しい声（Natural / Neural / Online）を上に置く");
}

console.log("── 受講コードを出すとき ──");
{
  /* 請求書に「お振込みの確認後、受講コードを発行します」と書いてあるのに
     申込みと同時に配ると、払わずに受講できる */
  const order = read("src/app/api/order/route.ts");
  check(!/issueSeats/.test(order), "申し込んだだけでは、受講コードを作らない");

  const owner = read("src/app/api/owner/orders/route.ts");
  check(/issueSeats/.test(owner), "入金を確認したときに作る");
  const hook = read("src/app/api/stripe/webhook/route.ts");
  check(/issueSeats/.test(hook), "カード払いは Stripe の知らせで作る");

  /* 二度押しても増えない（すでにある枚数を数えてから足す） */
  check(/count: "exact"/.test(owner), "すでにある枚数を数えてから足す");
}

console.log("── 請求書 ──");
{
  const legal = read("src/content/legal.ts");
  check(/SELLER_BANK_NAME/.test(legal), "振込先を設定から読む");
  check(/bankReady/.test(legal), "そろっていなければ出さない");

  const inv = read("src/app/owner/invoice/[orderId]/InvoiceClient.tsx");
  check(/invoice-bank/.test(inv), "請求書に振込先を出す");
  /* 期日を書くと「その日までに使える」と読めてしまう。
     振込を確認してから受講コードを出す決まりなので、日付は書かない */
  check(!/お支払期限　<strong>\{day\(o\.due\)\}/.test(inv), "支払期限に日付を書かない");
  check(/確認次第/.test(inv), "支払期限は「確認次第」と書く");

  const api = read("src/app/api/owner/invoice/route.ts");
  check(/bankReady/.test(api), "振込先は、そろっているときだけ返す");
}

console.log("── 請求書を相手にも見せる ──");
{
  /* よその会社の請求書には宛名も金額も載っている。
     注文の番号さえ分かれば開ける、という形にしてはいけない */
  const api = read("src/app/api/owner/invoice/route.ts");
  check(/maySeeInvoice/.test(api), "誰に見せてよいかを、決まりに通してから返す");
  check(/currentAdmin\(\)/.test(api), "本部でなければ、買った側かどうかを見る");
  check(/mark_invoiced/.test(api), "送ったことを立てられる");

  const acc = read("src/lib/invoiceAccess.ts");
  check(/order\.user_id === who\.userId/.test(acc), "個人の注文は、申し込んだ本人だけ");
  check(/status", "pending"/.test(acc) && /invoiced_at/.test(acc),
    "知らせるのは、送ってあって、まだ払っていないものだけ");

  /* 送る前に「届いています」と出すと、手元に無いのに届いたことになる */
  const inv = read("src/app/owner/invoice/[orderId]/InvoiceClient.tsx");
  check(/invoice-send/.test(inv), "本部の画面に「相手に知らせる」がある");
  check(/!mine &&/.test(inv), "買った側の画面には出さない");

  const home = read("src/components/HomeCards.tsx");
  check(/home-bill/.test(home), "買った側のホームに「請求書が届いています」を出す");
  check(/\/invoice\/\$\{bills\[0\]\.id\}/.test(home), "押すと、その請求書が開く");
}

console.log("── 担当者と無償利用の穴 ──");
{
  /* 参加コードは一般の社員に配るもの。自分の会社を作って担当者に
     なった人が、よその会社の参加コードを入れただけで、その会社の
     担当者になれてしまっていた */
  const sql = read("supabase/migrations/0021_role.sql");
  check(/v_now is distinct from p_company/.test(sql), "別の会社へ移ったときは担当者を降ろす");
  check(/role = 'learner'/.test(sql), "降ろす先は受講者");
  check(/leave_company/.test(sql), "会社を抜けたときも降ろす");

  /* 事業者が1社しかないと、新しく登録した人に自動でその会社の
     company_id が入る（0007）。控えで無償利用を通していたので、
     知らない人が登録しただけで教材が全部開いていた */
  const ent = read("src/lib/entitleQuery.ts");
  check(/companyId === memberOf/.test(ent),
    "無償利用は、許可の下りた在籍のときだけ通す（控えでは通さない）");

  /* 取り消した注文を、あとから入金にできてしまっていた */
  const owner = read("src/app/api/owner/orders/route.ts");
  check(/order\.status !== "pending"/.test(owner), "入金にできるのは、入金待ちのものだけ");
  check(/\.eq\("status", "pending"\)/.test(owner),
    "入金にするときも入金待ちを条件にする（同時に押しても2倍出ない）");
}

console.log("── 講座の種類（特別教育／職長教育）──"); 
{
  /* 職長教育は安衛法60条。特別教育（59条3項）とは別の制度。
     修了証が条文を決め打ちしていたので、そのまま足すと
     「59条3項に基づく特別教育を修了した」という嘘の紙が出るところだった。
     号の違う特別教育を足したときも同じ */
  const draw = read("src/components/edu/drawCert.ts");
  check(!/第59条第3項及び労働安全衛生規則第36条第39号/.test(draw),
    "修了証に条文を書き込まない（講座から出す）");
  check(/c\.courseBasis/.test(draw), "根拠は講座のもの");
  check(/c\.certTitle/.test(draw) && /c\.certLine/.test(draw), "表題と結びの文も講座から");

  const co = read("src/content/courses.ts");
  check(/CourseKind/.test(co) && /foreman/.test(co), "講座に種類がある");
  check(/第60条/.test(co), "職長教育は安衛法60条で置いてある");
  /* 職長教育は 2026年8月29日から公開。
     公開している講座は、教材と値段がそろっていること
     （そろっていないと、中身の無い講座を売ることになる） */
  check(/ready: true/.test(co), "職長教育を公開している");
  for (const c of COURSES.filter((x) => x.ready)) {
    check(
      existsSync(new URL(`../content/courses/${c.file}`, import.meta.url)),
      `${c.id}: 教材の json がある`,
    );
    check(
      typeof DEFAULT_COURSE_PRICE[c.id] === "number" && DEFAULT_COURSE_PRICE[c.id] > 0,
      `${c.id}: 値段が決まっている`,
    );
  }

  const home = read("src/app/page.tsx");
  check(/textOf\(c\)\.label/.test(home), "ホームの札も講座の種類から出す");
  check(!/特別教育（学科）/.test(home), "札に「特別教育」と書き込まない");
}

console.log("── 職長教育（討議のある講座）──");
{
  /* 職長教育は討議方式が原則。録画を見せるのは討議にならない */
  const co = read("src/content/courses.ts");
  check(/CourseType/.test(co) && /hybrid/.test(co), "講座に進み方がある（ondemand / live / hybrid）");
  check(/type: "hybrid"/.test(co), "職長教育は hybrid");
  check(/needsLive/.test(co), "決まった日時に集まる回が要るか、を出せる");

  /* 足りない教育で修了証を出さないための、いちばん大事な決まり */
  const h = read("src/lib/hours.ts");
  check(/judgeHours/.test(h), "法定を下回ったら公開しない判断がある");
  check(/judgeTalk/.test(h), "討議を終えたかの判断がある");
  check(/TALK_MAX = 15/.test(h), "1回に入れるのは15人まで");
  /* 開いただけ・繋いだだけでは修了にしない */
  check(/why: "answer"/.test(h), "課題に答えていなければ未修了");
  check(/why: "teacher"/.test(h), "講師の確認が無ければ未修了");

  const sql = read("supabase/migrations/0022_live.sql");
  check(/capacity between 1 and 15/.test(sql), "定員はデータベースでも15人まで");
  check(/book_live/.test(sql), "申し込みは、数えてから入れるまでを1つの手でやる");
  check(/live_in/.test(sql) && /live_out/.test(sql), "入退室を残す");
  check(/teacher_ok/.test(sql), "講師の確認を残す");
  check(/insert \/ update ポリシーは置かない/.test(sql), "出た記録は、クライアントから書けない");

  /* 講座を足しても courses に入らず、受講も席も作れなかった */
  const b = read("scripts/build-apply-all.ts");
  check(/courseRows/.test(b), "講座（courses）も courses.ts から作る");
  const all = read("supabase/apply-all.sql");
  check(/\('shokucho'/.test(all), "足した講座が apply-all.sql に入っている");

  /* 「何分居た」を画面から送らせない。送らせると、
     繋がずに時間だけ積んで修了できてしまう */
  const api = read("src/app/api/live/route.ts");
  check(/rpc\("book_live"/.test(api), "申し込みはデータベースの手でやる（定員を超えない）");
  check(/live_in/.test(api) && /live_out/.test(api), "入退室もデータベースが時刻を付ける");
  check(!/spans/.test(api), "画面から入退室の時刻を受け取らない");
  check(!/away_min|awayMin/.test(api), "画面から離席の時間を受け取らない");
  check(!/teacher_ok/.test(api), "画面から講師の確認を立てさせない");
  /* よその会社の回に入れると、討議の中身がその会社の外に出る */
  check(/ses\.company_id !== \(co\?\.id \?\? null\)/.test(api), "よその会社の回には入れない");

  const q = read("src/lib/liveQuery.ts");
  check(!/\.or\(/.test(q), "見せてよい範囲を、文字列の組み立てで決めない");

  /* ── 討議は講座に1回だけ、45分 ──
     科目ごとに置くと、科目の数だけ日を合わせて集まることになる */
  const sh = read("src/content/shokucho.ts");
  check(/TALK_MIN = 45/.test(sh), "討議は45分");
  check(/TALK_SUBJECT/.test(sh), "その45分をどの科目の時間として数えるか決めてある");
  check(/talkDone\(/.test(q), "討議を終えたかは、講座に1つの判定");
  check(!/talkDoneBySubject/.test(q), "科目ごとの討議は残していない");
  check(/TALK_MIN/.test(api), "討議の時間は content から取る（画面に書かない）");

  /* ── つなぎ先（Zoom）は一覧に出さない ──
     一覧に混ぜると、申し込んでいない人にも URL が渡る */
  check(/roomUrl: _hidden/.test(api), "一覧では、つなぎ先を落としてから返す");
  check(/roomUrl: \(ses\.room_url/.test(api), "つなぎ先は「入る」を押したときだけ返す");
  check(/inWindow\(/.test(api), "始まる前や、終わったあとには渡さない");
  check(/EARLY_MIN/.test(q) && /LATE_MIN/.test(q), "渡してよい時間帯は liveQuery に置く");
  /* 顔の登録を済ませていない人に、討議の部屋を渡さない */
  check(/face_registered_at/.test(api), "受講の準備（顔の登録）が済んでいなければ入れない");
  check(/consented_at/.test(api), "同意が済んでいなければ入れない");
  /* 顔の特徴量は端末から出さない。受講中の照合と同じ */
  check(!/descriptor|faceDescriptor/.test(api), "顔の特徴量をサーバへ送らせない");

  /* 討議の画面。顔の照合は学科とまったく同じ作りを使う */
  const talk = read("src/app/edu/[courseId]/talk/TalkClient.tsx");
  check(/useVerification/.test(talk), "討議中も、学科と同じ照合を回す");
  check(/prepDone/.test(talk), "受講の準備が済んでいなければ、準備の画面へ送る");
  check(/action: "in"/.test(talk) && /roomUrl/.test(talk), "つなぎ先は「入る」を押して受け取る");
  check(!/room_url|zoom\.us\//.test(talk), "Zoom の URL を画面に書き込まない");
}

console.log("── 担当者が居なくなった会社を、戻せるか ──");
{
  /* 担当者を立てられるのは、その会社の担当者だけ（/api/admin/role）。
     その作りだと、唯一の担当者が辞めた・移った・自分を降ろした会社は
     誰も名簿を開けなくなる。前はデータベースを直接いじるしかなかった。
     売り物でそれは通らないので、本部だけが戻せる道を作る */
  const led = read("src/app/api/owner/ledger/route.ts");
  check(/export async function POST/.test(led), "本部から担当者を立て直せる");
  check(/currentOwner\(\)/.test(led), "本部（OWNER_EMAILS）だけが押せる");
  /* 抜けた人を担当者にすると、辞めた人がその会社の名簿を見続ける */
  check(/left_at/.test(led) && /approved_at/.test(led), "在籍している人しか立てない");
  /* users.company_id がよそを指したままだと、よその名簿が出る */
  check(/company_id: companyId/.test(led), "立てるときに、所属もその会社へ揃える");

  const rec = read("src/lib/records.ts");
  check(/u\.company_id === companyId/.test(rec), "担当者かどうかは、その会社の分だけ見る");

  /* 「/admin が開かない」と言われたときに答えられるように */
  const h = read("src/app/api/health/route.ts");
  check(/admin: !!admin/.test(h), "いま担当者かどうかを /setup が出せる");
  check(/company: co\?\.name/.test(h), "いまの所属も出せる（所属が無いのか、担当でないのか）");
}

console.log("── 照合の控えが、記録として残るか ──");
{
  /* 講座の目印を付けずに送ると、サーバは受講を割り出せず
     mode:"local" に落ちる。データベースには1行も残らない。
     元請や監督署に出すのはデータベースの記録なので、ここが抜けると
     「ちゃんと受けた」を示せなくなる */
  const v = read("src/lib/useVerification.ts");
  check(/courseId: string;/.test(v), "照合は、どの講座かを受け取る");
  check(/JSON\.stringify\(\{ courseId, lessonId, ok: true \}\)/.test(v), "通った控えに講座の目印を付ける");
  check(/JSON\.stringify\(\{ courseId, lessonId, reason \}\)/.test(v), "外れた控えにも講座の目印を付ける");

  const lc = read("src/app/edu/[courseId]/[lessonId]/LessonClient.tsx");
  check(/useVerification\(\{\s*courseId,/.test(lc), "学科の受講画面が、講座の目印を渡している");

  const log = read("src/app/api/verify-log/route.ts");
  check(/currentEnrollment\(courseId\)/.test(log), "受講は講座の目印から割り出す");
}

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
