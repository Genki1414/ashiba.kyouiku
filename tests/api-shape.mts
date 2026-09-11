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
  /* 無償利用は撤廃した（げんきさん 2026-09-09「無償利用は撤廃する」）。
     会社ごとに無料にする道が残っていると、切り忘れに気づけない */
  check(!/trial/.test(strip(gate)), "実務トレーニングは、無償利用で通さない");

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

  /* SQL を流したあとに毎回見る所。○×だけでなく**数字そのもの**を返す。
     前は checks の中に「0024 まで入っている」と紛れているだけで、
     ページのいちばん下まで探しにいく必要があった */
  check(/return \{ now, need, ok:/.test(health),
    "いま入っている版と、要る版の両方を返す");
  const setup = read("src/app/setup/SetupClient.tsx");
  check(/data-testid="schema-row"/.test(setup), "/setup に版の行がある");
  check(/h\.schema\.now/.test(setup) && /h\.schema\.need/.test(setup),
    "どちらの数字も画面に出す（片方では流し終わったか分からない）");
  /* いちばん上の札のすぐ下。下まで探させない */
  check(setup.indexOf('data-testid="schema-row"') < setup.indexOf("サーバ側（実行時に読まれる）"),
    "版は、環境変数より上に出す");

  /* 版は**誰が見ているかと関係ない**。ログインの手前で読むこと。
     前は受講の行がある人にしか返しておらず、合言葉が切れていると
     何も出ないうえ「未設定（端末内記録）」と出ていた。
     Supabase は正しく入っているのに、入っていないように読める */
  const early = health.slice(0, health.indexOf("if (!supabase || !enrollmentId)"));
  check(/const schema = await readSchema\(supabase\)/.test(early),
    "版は、ログインの手前で読む");
  const localOut = health.slice(
    health.indexOf("if (!supabase || !enrollmentId)"),
    health.indexOf("if (!supabase || !enrollmentId)") + 500,
  );
  check(/\n\s*schema,/.test(localOut), "ログインしていない人にも版を返す");
  /* 同じことを2度聞かない。**測るときだけ2回**（2026-09-10）。
     1回目には繋ぎ始め（TLSの握手）が乗るので、2回目が本当の1往復。
     3回以上なら、どこかで聞き直している */
  const asks = (health.match(/rpc\("schema_version"\)/g) ?? []).length;
  check(asks === 2, `版を聞くのは、測るための2回だけ（いま ${asks}回）`);
  check(/roundMs/.test(health), "1往復にかかる時間を返す（遠さが分かる）");
  check(/data-testid="db-round"/.test(read("src/app/setup/SetupClient.tsx")),
    "設定の画面に、往復の時間を出す");

  /* ── サーバの場所（2026-09-10）──
     往復が 219ms だった。手元なら1msも掛からないので、太平洋を渡っていた。
     vercel.json で東京に寄せたが、**寄ったかどうかは本番でしか分からない。**
     だから画面に出す。出す以上、どちらの返事にも入れておく
     （ログインしていない人の画面でも見られないと、確かめようがない） */
  check(/VERCEL_REGION/.test(health), "サーバの場所を返す");
  check(/\n\s*region,/.test(localOut), "ログインしていない人にも場所を返す");
  const fullOut = health.slice(health.lastIndexOf("return NextResponse.json({"));
  check(/\n\s*region,/.test(fullOut), "ログインしている人にも場所を返す");
  check(/data-testid="server-region"/.test(setup), "設定の画面に、サーバの場所を出す");

  /* 画面が「合っている」と言う場所と、実際に置く場所が食い違うと、
     遠いままなのに合っているように見える。**必ず同じ番号にする** */
  const vjson = JSON.parse(read("vercel.json"));
  const want = (setup.match(/const WANT_REGION = "([a-z0-9]+)"/) ?? [])[1] ?? "";
  check(Array.isArray(vjson.regions) && vjson.regions.length === 1,
    "サーバを置く場所を、1か所だけ決めてある");
  check(!!want && vjson.regions?.[0] === want,
    `置く場所と、画面が待つ場所が同じ（vercel.json ${vjson.regions?.[0]} / 画面 ${want}）`);
  check(/hnd1: "東京"/.test(setup), "番号だけでなく地名を出す");

  /* mode が "local" になる理由は2つあり、意味がまるで違う。
     鍵が無いのか、鍵はあって未ログインなのか */
  check(/justSignedOut/.test(setup), "未設定と未ログインを区別する");
  check(setup.includes("ログインしていません（設定は入っています）"),
    "設定が入っているのに「未設定」と出さない");
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
  /* **講座ごとの単価で、行ごとに計算すること。**
     まとめて申し込めるようにしたので（0029）、1つの単価に
     人数を掛けると、講座ごとに値段が違うのに合わなくなる */
  check(
    /quote\(picked\[c\.id\], c\.unitPrice\)/.test(oc),
    "画面は、講座ごとの単価で1行ずつ計算する",
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

console.log("── 受講リクエストが返す形 ──");
{
  /* コードを渡されていない人が開くのが /join。そこで「受けたい」を送れる。
     画面が読む項目が抜けると、講座が1つも並ばず、**押す物が無い画面**になる。
     型では捕まらない（fetch の戻りは any）ので、書いてある字で見る */
  const src = read("src/app/api/course-request/route.ts");
  check(/export async function GET/.test(src), "GET がある（/join が講座の一覧を読む）");
  for (const k of ["courseId", "name", "short", "requested", "hasSeat"]) {
    check(new RegExp(`\\b${k}:`).test(src), `講座の${k}を返している`);
  }
  check(/member:/.test(src), "在籍しているかを返している（していないと誰宛か決まらない）");
  check(/readyCourses\(\)/.test(src), "並べるのは、教材のできている講座だけ");
  /* 会社は画面から受け取らない。受け取ると、よその会社宛に送れてしまう */
  check(!/companyId/.test(src), "会社の番号を画面から受け取っていない");

  const join = read("src/app/join/JoinClient.tsx");
  for (const k of ["courseId", "requested", "hasSeat"]) {
    check(join.includes(k), `/join が ${k} を読んでいる`);
  }
  check(join.includes('"/api/course-request"'), "/join が受講リクエストを呼んでいる");

  /* 受講コードが要ると断られた画面からも送れる（2026-09-08）。
     こちらも同じ返しを読むので、項目が抜けると釦が出ない画面になる */
  const need = read("src/components/RequestCourse.tsx");
  for (const k of ["courseId", "requested", "hasSeat"]) {
    check(need.includes(k), `断られた画面が ${k} を読んでいる`);
  }
  check(need.includes('"/api/course-request"'), "断られた画面が受講リクエストを呼んでいる");
  /* 在籍しているかで出し分ける。していない人に釦だけ出すと、
     押しても「送れませんでした」で終わる */
  check(/member\?\.state !== "active"/.test(need), "在籍していない人には、先にやることを出す");
  /* 会社は画面から渡さない（GET と同じ決まり） */
  check(!/companyId/.test(need), "会社の番号を画面から渡していない");
  /* 会社に居ないと誰宛か決まらない。在籍しているときだけ出す。
     いまは「在籍している人」の節の中に置いてある（2026-09-10 の整理） */
  check(/!!reqs\?\.length/.test(join), "講座が取れていないときは出さない");
  check(
    join.indexOf("{active && (") < join.indexOf('data-testid="join-request"') &&
      join.indexOf('data-testid="join-request"') < join.indexOf("{pending && ("),
    "在籍しているときだけ出している",
  );

  const adm = read("src/app/admin/AdminClient.tsx");
  check(/\/order\?courseId=/.test(adm), "担当者の画面から、申し込み画面へ渡している");
  check(/seats=\$\{g\.rows\.length\}/.test(adm), "人数のぶんの席を渡している");

  const order = read("src/app/order/OrderClient.tsx");
  check(/params\.get\("seats"\)/.test(order), "申し込み画面が席の数を受け取っている");
  check(/n >= 1 && n <= MAX_SEATS/.test(order), "受け取った席の数を、そのまま信じていない");

  /* ── まとめ申込み（0029）──
     3講座を3回に分けると請求書が3枚出て、振込も3回になる。
     1回でまとめて振り込まれると、どの請求書の入金か分からない */
  const api = read("src/app/api/order/route.ts");
  check(/items\?:\s*Item\[\]/.test(api), "申込みは講座ごとの並びで受け取る");
  check(/group_id: groupId/.test(api), "同じ申込みの行に、ひとまとめの印を付ける");
  check(!/\bawait notify\("order"\)[\s\S]{0,80}for \(/.test(api),
    "知らせは申込み1件につき1回（講座の数だけ鳴らさない）");
  const oc2 = read("src/app/order/OrderClient.tsx");
  check(/body: JSON\.stringify\(\{ items,/.test(oc2), "画面は講座と人数の並びを送る");
  check(!/JSON\.stringify\(\{ courseId, seats,/.test(oc2),
    "1講座ぶんだけ送る古い形が残っていない");

  /* 請求書は group で1枚。行ごとに分かれない */
  const inv = read("src/app/api/owner/invoice/route.ts");
  check(/\.eq\("group_id"/.test(inv), "請求書は、同じ申込みの行をまとめて出す");
  check(/items,/.test(inv), "講座ごとの明細を返す");
  const invc = read("src/app/owner/invoice/[orderId]/InvoiceClient.tsx");
  check(/o\.items\?\.length/.test(invc), "請求書の画面が明細を並べる");

  /* 入金の確認も1回。振込が1回だから */
  const own = read("src/app/api/owner/orders/route.ts");
  check(/\.eq\("group_id", group\)/.test(own),
    "入金の確認は、申込みまるごと立てる（押し忘れた講座だけコードが出ない、を起こさない）");
  const hook = read("src/app/api/stripe/webhook/route.ts");
  check(/\.eq\("group_id", group\)/.test(hook), "カード払いの戻りも、申込みまるごと立てる");
  const co = read("src/app/api/stripe/checkout/route.ts");
  check(/line_items: lines\.map/.test(co), "カードは申込みまるごと1回で切る");
}

console.log("── 席を直接配るときの形 ──");
{
  /* 受けさせる人が決まっているなら、12文字を打たせる意味は無い。
     ただし **受講コードの方式は残す**（その場に居ない人、画面が動かないとき）。
     どちらも消えていないことを、ここで見張る */
  const api = read("src/app/api/admin/assign/route.ts");
  check(/rpc\("assign_seat"/.test(api), "assign_seat を呼んでいる");
  check(/p_company: admin\.companyId/.test(api), "会社は、ログインしている担当者のものを使う");
  /* 会社を画面から受け取ると、よその会社の席を配れてしまう */
  check(!/b\.company/.test(api) && !/companyId = /.test(api),
    "会社の番号を画面から受け取っていない");
  check(/currentAdmin\(\)/.test(api), "教育担当者でなければ断る");
  check(/findCourse\(courseId\)/.test(api), "無い講座を渡していない");

  /* 断る理由をそのまま出す。「空いている席がありません」と出れば、
     次にやること（申し込む）が分かる */
  check(/reason: error\.message/.test(api), "断った理由を、そのまま画面に出す");

  const sum = read("src/app/api/admin/summary/route.ts");
  check(/freeSeats/.test(sum), "講座ごとの空き席の数を返している");
  check(/expires_at/.test(sum), "期限切れの席は、空きに数えていない");

  const adm = read("src/app/admin/AdminClient.tsx");
  check(/"\/api\/admin\/assign"/.test(adm), "担当者の画面から呼んでいる");
  check(/freeSeats\[/.test(adm), "空きがあるときだけ出している");
  check(/r\.left \|\| r\.pending/.test(adm),
    "辞めた人・申し込み中の人には出していない");
  check(/\[\.\.\.r\.doing, \.\.\.r\.done\]\.some/.test(adm),
    "もう持っている人には出していない（受講中も取得済みも見る）");
  /* **「いま見ている講座」という状態を持たない。**
     前は画面の上で講座を選ばせていたが、選んでも名簿は変わらず
     （名簿は講座に関係なく全員が並ぶ）、73件の札で画面が埋まっていた
     （げんきさん 2026-09-09「これ必要？」）。
     配る講座は、配るその場で選ぶ */
  check(/const freeList = /.test(adm), "残数のある講座から配る（画面に選択の状態を持たない）");
  check(!/st\.course\b(?!s|Requests)/.test(adm), "「いま見ている講座」を持っていない");

  /* **受講コードの方式を消していない。** 残す約束 */
  const join = read("src/app/join/JoinClient.tsx");
  check(join.includes('data-testid="join-code"'), "受講コードを入れる所が残っている");
  check(join.includes('"/api/join"'), "受講コードを送る先が残っている");
  const joinApi = read("src/app/api/join/route.ts");
  check(/redeem_seat/.test(joinApi), "受講コードで入る道（redeem_seat）が残っている");
  const seat = read("src/app/api/admin/seat/route.ts");
  check(/releaseSeat/.test(seat), "配った席を、未使用に戻せる道が残っている");
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

  /* 請求書の札は BillCard（ホームの「はじめかた」のすぐ下）。
     いちばん急ぐ用なので、ほかの札の並びから外してある（2026-09-09） */
  const home = read("src/components/BillCard.tsx");
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
  /* 無償利用は撤廃した。会社ごとに無料にする道は残さない
     （げんきさん 2026-09-09） */
  check(!/trial/.test(strip(ent)),
    "学科は、無償利用で通さない");

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
  /* 送る形は send() にまとめた（2026-09-11。返事を見るようにしたため）。
     見たいのは**講座の目印が付いていること**なので、そこだけ見る */
  check(/send\(\{ courseId, lessonId, ok: true \}/.test(v), "通った控えに講座の目印を付ける");
  check(/send\(\{ courseId, lessonId, reason \}/.test(v), "外れた控えにも講座の目印を付ける");

  const lc = read("src/app/edu/[courseId]/[lessonId]/LessonClient.tsx");
  check(/useVerification\(\{\s*courseId,/.test(lc), "学科の受講画面が、講座の目印を渡している");

  const log = read("src/app/api/verify-log/route.ts");
  check(/currentEnrollment\(courseId\)/.test(log), "受講は講座の目印から割り出す");
}

console.log("── 読めなかったことを、0件に化けさせていないか ──");
{
  /* **2026-09-09 に実際に起きた。**

     版を上げる SQL（0029）を流す前に新しい画面を出したので、
     本部の一覧が `select` に無い列を読みに行き、データベースが断った。
     ところが `const { data } = await ...` で `error` を捨てていたので、
     `data` は null → `orders ?? []` → **画面には「0件」。**

     売った注文が1件も無いのと、読めないのとが同じ見え方になり、
     「請求書が消えた」ようにしか見えなかった。

     お金の画面（本部の一覧・請求書・元帳）だけは、断られたら
     **そう言う。**直し方（apply-all.sql）まで出す。 */
  for (const f of [
    "src/app/api/owner/orders/route.ts",
    "src/app/api/owner/invoice/route.ts",
    "src/app/api/owner/ledger/route.ts",
  ]) {
    const src = read(f);
    check(/error:\s*\w+Err\b/.test(src), `${f}：読み出しのエラーを受け取っている`);
    check(/apply-all\.sql/.test(src), `${f}：直し方（apply-all.sql）まで出す`);
    check(/status: 500/.test(src), `${f}：断られたら 500 を返す（0件で返さない）`);
  }

  /* 申込みも、版が古いときは直し方まで出す。
     生の「column group_id does not exist」だけでは、担当者に何もできない */
  const ord = read("src/app/api/order/route.ts");
  check(/apply-all\.sql/.test(ord), "申込み：版が古いときの直し方を出す");
}

console.log("── 受講リクエストの数が、申込みの画面まで届くか ──");
{
  /* 受講リクエストは担当者の画面に出るが、**申込みの画面には出ていなかった。**
     担当者がここへ来る理由の多くは「送られてきたぶんを買う」のに、
     何人ぶん要るのかを別の画面で数えて覚えてから来ることになっていた
     （げんきさん 2026-09-09）。

     **返す側にあっても、画面が組み立て直すところで落ちる。**
     実際に落ちて、札が1つも出なかった。だから両側を見る。 */
  const api = read("src/app/api/order/route.ts");
  check(/from\("course_requests"\)/.test(api), "申込みの口が、受講リクエストを数える");
  check(/\.is\("handled_at", null\)/.test(api), "**まだ対応していないものだけ**数える");
  check(/\.eq\("company_id", admin\.companyId\)/.test(api),
    "自社宛だけ数える（会社は画面から受け取らない）");
  check(/\brequests,/.test(api), "講座ごとの数を画面へ返す");

  const oc = read("src/app/order/OrderClient.tsx");
  check(/requests: j\.requests/.test(oc),
    "**画面が組み立て直すときに拾っている**（ここで落とすと札が1つも出ない）");
  check(/data-testid="order-requests"/.test(oc), "「受講リクエストが届いています」を出す");
  check(/data-testid="order-course-req"/.test(oc), "講座ごとの件数を出す");
  /* 合計だけだと、どの講座に何人ぶん要るのか分からない */
  check(/リクエスト\{req\[c\.id\]\}件/.test(oc), "講座ごとに「リクエスト◯件」と出す");
  /* 73本あるので、送られている講座を上に出さないと札が埋もれる */
  check(/req\[b\.id\] - req\[a\.id\]/.test(oc), "リクエストのある講座を、多い順に上へ出す");
  /* 押したら、その人数が入る。1から数え直させない */
  check(/set\(on \? 0 : \(req\[c\.id\] \|\| 1\)\)/.test(oc), "押すと、リクエストの人数が入る");
}

console.log("── 画面に出る字に、飾りの記号が混じっていないか ──");
{
  /* 注釈では ** で強めているが、**画面はそれを太字にしない。**
     文字列に書くと、そのまま ** が出る。
     実際に出た（申込みのあとの「請求書は**1枚**で送ります」。2026-09-09）。

     太字を解釈する画面（はじめかたの案内など）は bold() を通している。
     通していない所で ** を書いたら、ここで止める。 */
  const dirs = ["src/app", "src/components"];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${d}/${e.name}`);
      else if (e.name.endsWith(".tsx")) files.push(`${d}/${e.name}`);
    }
  };
  for (const d of dirs) walk(d);

  const bad: string[] = [];
  for (const f of files) {
    const src = read(f);
    /* 太字を解釈する画面は見ない */
    if (/function bold\(/.test(src)) continue;
    /* 注釈を落としてから、日本語を含む文字列だけ見る */
    const body = src.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of body.matchAll(/["`]([^"`\n]*\*\*[^"`\n]*)["`]/g)) {
      if (/[ぁ-んァ-ン一-龥]/.test(m[1])) bad.push(`${f}: ${m[1].slice(0, 40)}`);
    }
  }
  check(bad.length === 0, `画面に出る字に ** を書いていない（${bad.join(" ／ ") || "無し"}）`);
}

console.log("── 畳んだ見出しに、取得済みの件数が出るか（2026-09-10）──");
{
  /* げんきさん「73講座を畳んであるので、開かないと自分がどれを
     持っているか分からない」。畳んだままだと、何も取っていない人と
     20件取った人の画面が、そっくり同じに見える */
  const hc = read("src/components/HeldCount.tsx");
  check(/loadMe\(\)/.test(hc), "件数は /api/me から出す（作り置きの札には載せない）");
  check(/if \(!n\) return null/.test(hc), "0件のときは出さない");
  check(/data-testid="course-held-count"/.test(hc), "件数を見つけられる印がある");
  /* 配列をそのまま見張ると、描き直すたびに聞きに行く */
  check(/ids\.join\(","\)/.test(hc), "描き直しのたびに聞きに行かない");
  /* 畳んだ見出しは3か所ある（ホームの2つと、講座の一覧の中の1つ）。
     1つ入れ忘れると、その画面だけ分からないままになる */
  for (const f of [
    "src/components/CourseDrawer.tsx",
    "src/components/OtherTokubetsu.tsx",
    "src/app/edu/page.tsx",
  ]) {
    const d = read(f);
    check(/<HeldCount ids=/.test(d), `${f} の見出しに件数が出る`);
    check(d.indexOf("<HeldCount") < d.indexOf("</summary>"),
      `${f} は畳んだままでも見える所に出す`);
  }
}

console.log("── 画面から画面への移りが、往復で待たされないか（2026-09-10）──");
{
  /* げんきさん「遷移速度が遅いのを改善して」。

     遅さの正体は、**サーバでの順番待ち**だった。
     手元（Supabase なし）では 40〜110ms で移れるので、
     待っているのは Supabase までの往復。1回ぶん減らせば、そのぶん速くなる。 */

  /* ① 受けられるかを見る所。**通る人は1回で終わる。**
     会社の名前は断り文にしか使わないので、断ると決まってから聞く */
  const eq = read("src/lib/entitleQuery.ts");
  check(/orders!inner\(course_id\)/.test(eq), "席と注文を、ひと息に聞く");
  check(eq.indexOf("if (seat) return") < eq.indexOf("companyNameOf(supabase, userId)"),
    "会社の名前は、断ると決まってから聞く");
  check(!/from\("memberships"\)[\s\S]{0,400}from\("seats"\)/.test(eq),
    "席より先に所属を聞かない（通る人に要らない往復）");

  /* ② どの画面からも呼ばれる /api/me。互いに要らないものは同時に聞く */
  const meApi = read("src/app/api/me/route.ts");
  check((meApi.match(/Promise\.all\(/g) ?? []).length >= 2, "/api/me は並べて聞く");
  check(!/const learn = await canLearn\(\);[\s\S]{0,200}const held = await heldOf/.test(meApi),
    "/api/me が上から順に待たない");

  /* ③ 申込みの画面（げんきさん「受講コードを追加で申し込むがめちゃくちゃ遅い」）*/
  const ordApi = read("src/app/api/order/route.ts");
  check((ordApi.match(/Promise\.all\(/g) ?? []).length >= 2, "/api/order は並べて聞く");
  check(!/const counts = await seatCounts[\s\S]{0,200}const paid = await seatCounts/.test(ordApi),
    "/api/order が、数え上げを順番に待たない");

  /* ④ 単元の数は、先に数えてある。**73講座ぶんの教材（15MB）を毎回読まない**
        （げんきさん「マイページ開くのが遅い」） */
  const cur = read("src/lib/curriculum.ts");
  check(/return statOf\(courseId\)\.list;/.test(cur), "単元の一覧は、先に数えた表から返す");
  for (const f of ["src/app/api/mypage/route.ts", "src/app/api/admin/summary/route.ts"]) {
    const src = read(f);
    check(!/await readFile|getCurriculum\(/.test(src), `${f} が教材を開き直さない`);
  }
  const pkg = read("package.json");
  check(/npm run build:stats/.test(pkg), "作るときに、先に数え直す");

  /* ⑤ 講座の札の様子も、席と注文をひと息に */
  const held = read("src/lib/held.ts");
  check(/orders!inner\(course_id\)/.test(held), "札の様子も、席と注文をひと息に聞く");

  /* ④ 誰かを見るのは、ひとつの取りに行きで1回だけ */
  const sess = read("src/lib/supabase/session.ts");
  check(/export const currentUser = cache\(/.test(sess), "誰かを見るのは1回だけ（cache）");
  check(/getClaims\(\)/.test(sess), "手元で確かめられるなら、聞きに行かない（getClaims）");

  /* ⑤ 誰が見ても同じ画面は、作り置きにする。
        押すたびに組み立て直すと、そのぶん待つ */
  for (const [f, why] of [
    ["src/app/page.tsx", "ホーム"],
    ["src/app/edu/page.tsx", "講座の一覧"],
    ["src/app/me/page.tsx", "マイページ"],
  ] as const) {
    /* 注釈は見ない（「前は force-dynamic だった」と書いてある） */
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    check(/export const revalidate = 3600/.test(src), `${why}は作り置き`);
    check(!/force-dynamic/.test(src), `${why}を、押すたびに組み立て直さない`);
  }
  /* 人によって中身が変わる画面は、作り置きにしてはいけない */
  const cp = read("src/app/edu/[courseId]/page.tsx");
  check(/canLearn\(courseId\)/.test(cp) && !/export const revalidate/.test(cp),
    "受講コードを見る画面は、作り置きにしない");
}

console.log("── 決める操作は、全部「確かめる→終わった」を通るか（2026-09-10）──");
{
  /* げんきさん
       「請求書払いで申し込む とか、ほとんどのユーザーが行う操作全般
         なんだけど、確認表示や完了表示のポップアップがない。
         ユーザーが操作を行う部分を全て洗い出して、
         全てに確認表示・完了表示のポップアップを付ける」

     **サーバに書く（POST する）画面は、全部 AskDone を持つ。**
     持たない画面は、下の表に理由を書く。書いていなければ止める。
     新しい画面で POST を足したら、ここで気づく。 */
  const NO_ASK: Record<string, string> = {
    /* 出すだけ。何も変えない */
    "src/components/AppCode.tsx": "引き換えコードを出すだけ（5分で消える。取り消すものが無い）",
    /* 開いたら読んだことにする。押させない */
    "src/components/Notices.tsx": "読んだ印。開いた時点で付く（押す所が無い）",
    /* 受講の準備の流れそのもの。同意の画面が確かめる所 */
    "src/app/edu/[courseId]/prep/PrepClient.tsx": "受講の準備（同意→顔→はじめる）。同意の画面が確かめる所で、途中に札を挟むと流れが切れる",
  };
  const postFiles: string[] = [];
  const walk4 = (d: string) => {
    for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk4(`${d}/${e.name}`);
      else if (e.name.endsWith(".tsx")) postFiles.push(`${d}/${e.name}`);
    }
  };
  for (const d of ["src/app", "src/components"]) walk4(d);
  /* **fetch だけを見ていると漏れる。**
     パスワードの決め直し（supabase.auth.updateUser）と、決め直しのメール
     （resetPasswordForEmail）は fetch を書かないので、はじめの見張りは
     素通りしていた（げんきさん 2026-09-10「抜けがないか確認して」で見つかった）。
     道具ごしに書くものも、サーバに書く画面として数える */
  const WRITES = /method: "(POST|PUT|DELETE|PATCH)"|auth\.(updateUser|signUp|resetPasswordForEmail)\(/;
  const posting = postFiles.filter((f) => WRITES.test(read(f)));
  check(posting.length >= 20, `サーバに書く画面を見つけている（${posting.length}）`);
  /* 見つけ方そのものを見張る。fetch だけに戻したら止める */
  check(/auth\\.\(updateUser\|signUp\|resetPasswordForEmail\)/.test(read("tests/api-shape.mts")),
    "道具ごしに書くもの（supabase.auth）も数えている");
  for (const f of posting) {
    const src = read(f);
    const has = /<AskDone /.test(src);
    const why = NO_ASK[f];
    check(has || !!why, `${f}：確かめる札があるか、無い理由が書いてある`);
    if (has && why) check(false, `${f}：札があるのに「無い理由」も書いてある（表から消す）`);
  }
  /* 表に載っている画面が消えたら、表も直す */
  for (const f of Object.keys(NO_ASK)) {
    check(existsSync(new URL(`../${f}`, import.meta.url)), `${f}：表にあるが、もう無い`);
  }

  /* 押した瞬間に送っていないか。決める釦は setAsk か askPost を経る。
     **ここに挙げたものは、げんきさんが名指ししたか、金・所属・修了証が動くもの** */
  const must: [string, string][] = [
    ["src/app/order/OrderClient.tsx", 'onClick={() => askOrder("invoice")}'],
    ["src/app/order/OrderClient.tsx", 'onClick={() => askGive(c)}'],
    ["src/app/order/OrderClient.tsx", 'onClick={() => askRelease(c)}'],
    ["src/app/join/JoinClient.tsx", 'onClick={askGo}'],
    ["src/app/join/JoinClient.tsx", 'onClick={() => askApply(c)}'],
    ["src/app/join/JoinClient.tsx", 'onClick={() => askDrop(active.company, false)}'],
    ["src/app/me/MeClient.tsx", 'onClick={askSave}'],
    ["src/app/me/MeClient.tsx", 'onClick={askSignOut}'],
    ["src/app/edu/[courseId]/cert/CertClient.tsx", 'onClick={askIssue}'],
    ["src/app/edu/[courseId]/exam/ExamClient.tsx", 'askSubmit(n)'],
    ["src/app/train/TrainOrderClient.tsx", 'run: send,'],
    ["src/app/admin/AdminClient.tsx", 'payload: { userId: q.userId, action: "approve" }'],
    ["src/app/admin/AdminClient.tsx", 'payload: { enrollmentId, action: "issue" }'],
    ["src/app/admin/AdminClient.tsx", 'payload: { newCode: true }'],
    ["src/app/owner/OwnerClient.tsx", 'onClick={() => askOrder(o, "paid")}'],
    ["src/app/owner/RetentionClient.tsx", 'onClick={() => askErase(r)}'],
    /* メールが外に飛ぶ。打ち間違えたら、こちらからは取り消せない */
    ["src/app/login/LoginClient.tsx", 'onClick={mode === "forgot" ? askReset : go}'],
    /* 決め直すと、前の合言葉はその場で使えなくなる */
    ["src/app/login/new/NewPasswordClient.tsx", 'onClick={askGo}'],
  ];
  for (const [f, needle] of must) {
    check(read(f).includes(needle), `${f}：${needle.slice(0, 40)} が確かめる札を通る`);
  }
  /* window.prompt / confirm は使わない。字が小さく、スマホで画面の外に出る */
  for (const f of posting) {
    check(!/window\.(prompt|confirm)\(/.test(read(f)), `${f}：window.prompt / confirm を使っていない`);
  }
  /* 札は「確かめる → やる → 終わった」の3つを持つ */
  const ad = read("src/components/AskDone.tsx");
  for (const t of ["ask-done-title", "ask-done-yes", "ask-done-no", "ask-done-done", "ask-done-close"]) {
    check(ad.includes(`data-testid="${t}"`), `AskDone に ${t} がある`);
  }
  check(/if \(fin\) ask\.after\?\.\(\)/.test(ad), "after は、終わって閉じたときだけ動く");

  /* ── 挟まないと決めた所は、挟まないままにする ──
     ログインと新規登録は毎日押すもの。一手増えると邪魔になるだけ。
     引き換えコードも同じ（ログインの一部）。ここに札を足したくなったら、
     まず「毎日押すものか」を考えること */
  const lg = read("src/app/login/LoginClient.tsx");
  check(/onClick=\{mode === "forgot" \? askReset : go\}/.test(lg),
    "ログイン・新規登録そのものには挟まない（決め直しのメールだけ）");
  check(/onClick=\{\(\) => void useCode\(\)\}/.test(lg), "引き換えコードにも挟まない");
}

console.log("── 受講する人の画面に「席」と書いていないか ──");
{
  /* 「席」は帳簿の言葉。売り物の数を数えるときは要るが、
     **受講する人には「受講コード」と言う**（前からの決まり）。
     混ぜると、渡された12文字が「席」なのか別物なのか分からなくなる。

     実際に残っていた（受講コードを入れる画面の「席（受講コード）を用意」と
     「席あり」。2026-09-10）。注釈は見ない（考え方を書く所なので）。
     運営と受講管理の画面は数を扱うので、ここでは見ない。
     「在席確認」は別の言葉（その場に居るか）なので通す。 */
  const skip = ["src/app/admin", "src/app/owner"];
  const seatFiles: string[] = [];
  const walk2 = (d: string) => {
    if (skip.some((k) => d.startsWith(k))) return;
    for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk2(`${d}/${e.name}`);
      else if (e.name.endsWith(".tsx")) seatFiles.push(`${d}/${e.name}`);
    }
  };
  for (const d of ["src/app", "src/components"]) walk2(d);

  const seats: string[] = [];
  for (const f of seatFiles) {
    const body = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of body.matchAll(/(.?)席/g)) {
      if (m[1] === "在") continue;
      seats.push(`${f}: …${body.slice(Math.max(0, m.index - 12), m.index + 8)}…`);
    }
  }
  check(seats.length === 0, `受講する人の画面に「席」と書いていない（${seats.join(" ／ ") || "無し"}）`);
}

console.log("── 受講を始める画面が、その人のいる所を言うか（2026-09-10）──");
{
  /* げんきさん「UIも動線が分かりにくいから整理して欲しい」。
     ホームの札4枚が、どれも /join へ行く。名前が違うのに
     着いた先の見出しは「会社とつなぐ」のままだった */
  const j = read("src/app/join/JoinClient.tsx");
  check(/data-testid="join-title"/.test(j), "画面の名前を出す所がある");
  for (const t of ["受講をはじめる", "承認を待っています", "会社とつなぐ"]) {
    check(j.includes(`"${t}"`), `いる所で名前が変わる（${t}）`);
  }
  /* 番号は使わない。**出ない節があるので、必ず飛ぶ** */
  const jBody = j.replace(/\/\*[\s\S]*?\*\//g, "");
  check(!/[①②③④]/.test(jBody), "節に番号を振らない（出ない節があると飛ぶ）");
  /* 在籍している人には、受講コードがいちばん上 */
  check(j.indexOf("{codeBox}") < j.indexOf('data-testid="join-active"'),
    "在籍している人には、受講コードを所属より上に出す");

  /* 押した札の名前が、着いた先に出ているか */
  const h = read("src/components/HomeCards.tsx");
  for (const t of ["承認を待っています", "会社とつなぐ", "受講コードを入れる", "受講リクエストを送る"]) {
    check(h.includes(t) && j.includes(t), `札の名前が、着いた先にもある（${t}）`);
  }
}

console.log("── 1回の申込みを、1件として見せているか ──");
{
  /* **請求書だけ1枚にして、ほかを行ごとのままにしていた**（2026-09-09）。
     げんきさんの実機で3つ出た。

       ・請求書は 42,900円 なのに、ホームの知らせは 4,950円
       ・本部の画面に、1回の申込みが3枚のカードで並び、
         「入金を確認した」が3つ出た
       ・請求書を出したかどうかが、画面から分からない

     まとめたなら、**数える所・見せる所・印を付ける所を全部そろえる。** */
  const own = read("src/app/api/owner/orders/route.ts");
  check(/byGroup/.test(own), "本部の一覧は、申込みごとにまとめて返す");
  check(/invoiced_at/.test(own), "請求書を送った日も読む（送ったかどうかを出せるように）");
  check(/items: \[it\]/.test(own), "講座ごとの明細を中に入れる");

  const oc = read("src/app/owner/OwnerClient.tsx");
  check(/o\.invoiced_at/.test(oc), "本部の画面が「送ったかどうか」を出す");
  check(/未送信/.test(oc), "送っていないことを、字で出す");
  check(/data-testid="owner-items"/.test(oc), "講座ごとの明細を並べる");

  const inv = read("src/lib/invoiceAccess.ts");
  check(/byGroup/.test(inv), "届いている請求書も、申込みごとにまとめる");
  check(/g\.amount \+= o\.amount/.test(inv),
    "**金額は足す**（行ごとに数えると、知らせと請求書が食い違う）");

  /* 「請求書を出した」印も申込みまるごと（0030）。
     SQL の中身は supabase/tests/order-group.sql が見ている */
  const m30 = read("supabase/migrations/0030_invoiced_group.sql");
  check(/where group_id = v_group/.test(m30), "印は申込みまるごとに付ける");
  check(/coalesce\(invoiced_at, now\(\)\)/.test(m30), "送り直しで日付を動かさない");
}

console.log("── 受講コードを指して配る（0031）──");
{
  /* 受講コードの一覧の「配る」は、**押したそのコード**が渡らないとおかしい。
     SQL の中身は supabase/tests/assign-by-code.sql が見ている */
  const m31 = read("supabase/migrations/0031_assign_by_code.sql");
  check(/drop function if exists public\.assign_seat\(uuid, uuid, text, uuid\)/.test(m31),
    "古い形（4つ）を消してから作り直す（同じ名前が2本並ばない）");
  check(/p_code is null or s\.code = p_code/.test(m31), "コードを指したら、その1枚だけ");
  check(/その受講コードは配れません/.test(m31), "配れない理由を1つにまとめている");
  /* よその会社のコードを打って「別の講座です」と返すと、在ることを教えてしまう */
  check(!/別の講座のコードです/.test(m31) && !/よその会社/.test(m31.replace(/--.*$/gm, "")),
    "断る文で、よその会社のコードの在り処を教えない");

  const api = read("src/app/api/admin/assign/route.ts");
  check(/normalizeJoinCode\(b\.code\)/.test(api), "打ち方の揺れをそろえてから渡す");
  check(/p_code: code \|\| null/.test(api), "指さなければ自動（null）");
  check(/addNotice\(userId, "given"/.test(api), "受け取った本人に知らせる");
  const nt = read("src/lib/noticeText.ts");
  check(/given: \{[^}]*\/edu\/\$\{c\}/.test(nt), "知らせを押すと、その講座がそのまま開く");
  check(!/given: \{[^}]*コードを入れ/.test(nt), "知らせで「コードを入れろ」と言っていない（打たせない）");

  const oc = read("src/app/order/OrderClient.tsx");
  check(/order-code-give-go/.test(oc) && /code: c\.code/.test(oc), "一覧の「配る」が、押したそのコードを送る");
  /* 返す側にあっても、組み立て直す所で落とすと「配る」が1つも出ない
     （requests で一度やった。members でもやった。2026-09-09） */
  check(/members: Array\.isArray\(j\.members\)/.test(oc), "GET の members を、画面の組み立てで拾っている");
  const or = read("src/app/api/order/route.ts");
  check(/\.is\("left_at", null\)/.test(or) && /\.not\("approved_at", "is", null\)/.test(or),
    "配る相手は、在籍している人だけ");
}

console.log("── 取得済みの資格には配れない ──");
{
  /* げんきさん（2026-09-09）「取得済の資格には受講コード配布不可」
     「取得済みの資格は講座一覧にも取得済表示」。
     取得済みの数え方は1か所（src/lib/held.ts）。画面が3つ見るので、
     ばらばらに数えると食い違う */
  const held = read("src/lib/held.ts");
  check(/\.is\("revoked_at", null\)/.test(held), "取り消した修了証は取得済みに数えない");
  check(/findQual\(/.test(held) && /held_quals/.test(held), "よそで取った資格も、講座に当たれば取得済み");

  const m31 = read("supabase/migrations/0031_assign_by_code.sql");
  check(/from public\.certificates c/.test(m31) && /取得済み/.test(m31), "SQL でも、修了証が出ている人には渡さない");

  const api = read("src/app/api/admin/assign/route.ts");
  check(/heldCourseIds\(supabase, \[userId\]\)/.test(api) && /status: 409/.test(api),
    "画面をすり抜けても、配る口で断る");
  const or = read("src/app/api/order/route.ts");
  check(/heldCourseIds\(supabase, memberIds\)/.test(or) && /held: heldBy\.get/.test(or),
    "配る相手に、取得済みの講座を付けて返す");
  const oc = read("src/app/order/OrderClient.tsx");
  check(/disabled=\{has\}/.test(oc) && /（取得済）/.test(oc), "取得済みの人は、名前は出すが押せない");
  const adm = read("src/app/admin/AdminClient.tsx");
  check(/!r\.held\.some\(\(h\) => h\.courseId === c\.id\)/.test(adm),
    "名簿の「受講コードを配る」も、よそで取った資格を見る");
  const q = read("src/lib/quals.ts");
  check(/courseId: q\?\.courseId \?\? null/.test(q), "よそで取った資格に、講座の id を付けている");

  /* 講座一覧の札 */
  const me = read("src/app/api/me/route.ts");
  check(/heldCourseIds\(/.test(me) && /held,/.test(me), "/api/me が取得済みの講座を返す");
  const mel = read("src/lib/me.ts");
  check(/held: Array\.isArray\(j\.held\)/.test(mel), "端末に覚える形にも held がある");
  const card = read("src/components/CourseCard.tsx");
  check(/<HeldMark courseId=\{c\.id\} \/>/.test(card), "講座の札に「取得済」が付く（ホームも /edu も同じ札）");
  const mark = read("src/components/HeldMark.tsx");
  check(/loadMe\(\)/.test(mark) && /readMe\(\)/.test(mark), "札は /api/me に1本で聞く（枚数ぶん行かない）");
  check(/取得済/.test(mark) && !/取得済み資格/.test(mark), "札の文字は「取得済」");
}

console.log("── 請求書の一覧と、紙にしたときの形 ──");
{
  /* げんきさん（2026-09-09）「請求書が1枚になってない」
     「請求書を発行すると過去の請求書が見れなくなるから、請求書ページ作って残して」 */
  const css = read("src/app/globals.css");
  check(/@media print \{[\s\S]*@page \{ size: A4/.test(css), "紙は A4。余白は @page で持つ");
  check(/@media print \{[\s\S]*\.shell \{ max-width: none !important/.test(css), "紙のときは外枠のスマホ幅を外す");
  check(/@media print \{[\s\S]*\.tape, \.noprint \{ display: none/.test(css), "テープと操作の行は紙に出ない");
  const lay = read("src/app/layout.tsx");
  check(/className="shell /.test(lay), "外枠に .shell が付いている（印刷の決まりの当て先）");
  const inv = read("src/app/owner/invoice/[orderId]/InvoiceClient.tsx");
  check(/page-break-inside: avoid/.test(inv), "請求書の紙は途中で割らない");
  check(/href="\/invoices"/.test(inv) && /mine &&/.test(inv), "買った側の請求書から一覧へ戻れる");

  const api = read("src/app/api/invoices/route.ts");
  check(/currentUser\(\)/.test(api) && /status: 403/.test(api), "ログインしていなければ断る");
  check(/companyId: admin\?\.companyId \?\? null/.test(api), "会社は、ログインしている人のものを使う");
  check(!/searchParams/.test(api), "会社も人も画面から受け取らない");
  check(/status: 500/.test(api) && /apply-all\.sql/.test(api), "読めなかったら「0件」ではなく、そう言う");
  const acc = read("src/lib/invoiceAccess.ts");
  check(/export function groupInvoices/.test(acc) && /o\.group_id \?\? o\.id/.test(acc), "申込み（group）ごとに1件にまとめる");
  check(/\.eq\("user_id", who\.userId\)/.test(acc) && /\.eq\("company_id", who\.companyId\)/.test(acc),
    "自分の注文と、自分の事業者の注文だけ");
  const cl = read("src/app/invoices/InvoicesClient.tsx");
  check(/e\.invoicedAt \? \(/.test(cl) && /invoice-row-wait/.test(cl), "発行済みだけ開ける。未発行はそう言う");
  check(/href=\{`\/invoice\/\$\{e\.id\}`\}/.test(cl), "開く先は買った側の請求書");
  const oc = read("src/app/order/OrderClient.tsx");
  check(/href="\/invoices"/.test(oc), "申込みの画面から一覧へ行ける");
  const hc = read("src/components/BillCard.tsx");
  check(/bills\.length > 1 \? "\/invoices"/.test(hc), "請求書が2件以上なら、ホームの札は一覧へ");
}

console.log("── クーポンと広告費（0032）──");
{
  /* げんきさん（2026-09-09）
       「紹介クーポンや業界団体向けクーポンを出すことになる」
       「どのクーポンが利用されて、どのくらいの売上になってるかも把握したい」
       「広告費としてクーポン利用売上の何%かを支払いしようと思ってる」
     決めたこと：値引きは率と定額の両方、広告費は**割引後の税抜 ×％**。
     計算の中身は tests/coupon.ts と supabase/tests/coupon.sql が見ている */
  const m32 = read("supabase/migrations/0032_coupon.sql");
  check(/create table if not exists public\.coupon_uses/.test(m32), "使われた記録を残している");
  check(/group_id\s+uuid not null unique/.test(m32), "申込みまるごとに1枚（同じ申込みに2枚使えない）");
  /* 使った時の率を焼き付ける。あとで率を変えても、過去の約束は動かない */
  check(/reward_rate int not null check/.test(m32), "使った時の率を記録に焼き付けている");
  check(/\(p_gross - chk\.discount\) \* chk\.reward_rate\) \/ 100/.test(m32),
    "広告費は割引後の税抜に率を掛ける");
  check(/o\.status <> 'cancelled'/.test(m32), "取り消した申込みは、使った回数に数えない");
  check(/constraint coupons_one_kind/.test(m32), "率と定額は、どちらか一方だけ");

  /* 値引きの式は SQL と画面の両方にある。**片方だけ直すと、
     見せた金額と請求する金額が食い違う** */
  const lib = read("src/lib/coupon.ts");
  check(/Math\.floor\(\(g \* pct\) \/ 100\)/.test(lib), "率の端数は切り捨て（SQL と同じ）");
  check(/Math\.min\(d, g\)/.test(lib), "値引きは割引前を超えない（SQL と同じ）");
  check(/export function spreadDiscount/.test(lib), "値引きを講座ごとの行に配る");

  const api = read("src/app/api/order/route.ts");
  check(/rpc\("use_coupon"/.test(api), "引くかどうかは SQL が決める（画面の額を信じない）");
  check(/spreadDiscount\(lines\.map/.test(api), "値引きを行に配ってから入れている");
  check(/release_coupon_use/.test(api), "注文を作れなかったら、クーポンを使ったことにしない");
  check(/\.\.\.\(couponId \? \{ coupon_id: couponId/.test(api),
    "クーポンを使ったときだけ列を足す（版が古くても今までどおり通る）");

  const pre = read("src/app/api/coupon/route.ts");
  check(/currentAdmin\(\)/.test(pre), "教育担当者でなければ断る");
  check(/unitPrice\(course\.id\)/.test(pre), "単価はサーバが持っているものを使う");
  check(!/b\.gross|b\.amount|b\.total/.test(pre), "金額を画面から受け取らない");
  /* 広告費の率は買う側に見せる話ではない */
  check(!/reward/.test(strip(pre)), "買う側に広告費を返していない");

  const oc = read("src/app/order/OrderClient.tsx");
  check(/order-coupon-check/.test(oc) && /code: coupon \? code : ""/.test(oc),
    "確かめたクーポンだけを送る");
  check(/Math\.floor\(net2 \* TAX_RATE\)/.test(oc), "税は値引きしたあとにかかる");
  /* 押したときの額を持ち回ると、人数を変えたときに古い値引きが残る */
  check(/discountOf\(coupon, sum\.subtotal\)/.test(oc), "人数を変えたら、値引きもその場で計算し直す");
  check(!/discount:/.test(oc.split("const order = async")[1] ?? ""), "値引きの額は送らない");

  const inv = read("src/app/api/owner/invoice/route.ts");
  check(/const gross = items\.reduce/.test(inv) && /const net = gross - discount/.test(inv),
    "請求書は、値引き前の小計と値引きを分けて出す");
  const invc = read("src/app/owner/invoice/[orderId]/InvoiceClient.tsx");
  check(/invoice-discount/.test(invc), "請求書に値引きの行がある");
  check(!/reward/.test(invc), "請求書に広告費は出さない");

  const own = read("src/app/api/owner/coupons/route.ts");
  check(/currentOwner\(\)/.test(own), "本部でなければ断る");
  check(/status: 500/.test(own) && /apply-all\.sql/.test(own), "読めなかったら「0件」ではなく、そう言う");
  check(/if \(st === "cancelled"\) continue/.test(own), "取り消した申込みは数えない");
  check(/rewardRate > 0 && !partnerId/.test(own), "広告費を出すなら、支払い先を決めさせる");
  const ownc = read("src/app/owner/CouponClient.tsx");
  const owncTxt = strip(ownc);
  check(/入金あり/.test(owncTxt) && /入金待ち/.test(owncTxt), "入金のあった分と、待ちの分を分けて出す");

  /* ── 「入金済み」が二通りに読めた（げんきさん 2026-09-10）──
       「広告費の入金済みとはどういう意味？」
     こちらが払い終えた広告費、とも読める。そうではなく、
     お客様からご入金があった申込みの分、という意味だった。
     画面の字から「入金済み」を無くし、誰の入金かを必ず書く。
     振込の管理はこの仕組みではやっていないので、それも書く */
  check(!/入金済み/.test(owncTxt), "画面に「入金済み」とだけ書かない（誰の入金か分からない）");
  check(/お支払いする広告費/.test(owncTxt), "広告費は「お支払いする額」と書く");
  check(/振込が済んだかどうかは、この画面では見ていません/.test(owncTxt),
    "払ったかどうかは見ていない、と書いてある");
  check(/お客様からのご入金を確認した/.test(owncTxt), "どちらの入金かを書いてある");

  /* ── 0件でも枠を出す（げんきさん 2026-09-10「月別が見れない、表示がない」）──
     0件のときに丸ごと消していたので、作ったのに無いように見えた */
  check(!/if \(!months\.length\) return null/.test(ownc),
    "利用が0件でも、月別の枠は消さない");
  check(/まだ利用がありません/.test(owncTxt), "0件のときは、空だと書く");

  /* ── 直すと消す（0038・げんきさん 2026-09-10「クーポンに編集と削除を追加して」）──

     ① 名前を直すと、**もう渡した請求書の字まで変わっていた。**
        請求書は coupons.name を生で読んでいた。使った時の名前を
        記録に焼き付けて、請求書はそちらを見る
     ② コードと値引きは、配った絵と紙に刷ってある。使われたあとに変えると、
        相手の持っている券が通らなくなる。使われる前だけ直せる
     ③ 使われたクーポンは消せない。払った広告費の裏が取れなくなる */
  const m38 = read("supabase/migrations/0038_coupon_edit.sql");
  check(/add column if not exists coupon_name/.test(m38), "使われた時の名前を記録に残す");
  check(/update public\.coupon_uses[\s\S]*set coupon_name = c\.name/.test(m38),
    "これまでの記録にも、いまの名前を入れておく");
  check(/coupon_id, coupon_name, group_id/.test(m38), "使うときに、名前も焼き付ける");
  const inv2 = read("src/app/api/owner/invoice/route.ts");
  check(/from\("coupon_uses"\)[\s\S]{0,80}coupon_name/.test(inv2),
    "請求書は、使った時の名前を見る（直しても渡した書類は変わらない）");
  check(/if \(!couponName\)/.test(inv2), "焼き付けが無い古い記録は、いまの名前で埋める");

  check(/action === "edit"/.test(own), "直す口がある");
  check(/action === "delete"/.test(own), "消す口がある");
  /* **数えられなかったら、0件として扱わない。**
     0と思い込むと、使われたクーポンを消してしまう */
  check(/return error \? null : \(count \?\? 0\)/.test(own),
    "使われた回数を数えられなかったら、null にする（0にしない）");
  check(/if \(used === null\)/.test(own), "数えられなかったときは、直さず・消さない");
  check(/if \(used > 0\)/.test(own) && /status: 409/.test(own), "使われたクーポンは消さない");
  /* 画面で隠すだけにしない。口を直に叩かれても通さない */
  check(/} else if \(wantCode \|\| wantOff\) \{/.test(own),
    "使われたあとのコードと値引きは、口でも断る");
  check(/foreign key\|violates\|restrict/.test(own),
    "数えたあとに使われたときも、そう言う（表の作りが止める）");
  /* 期限と回数は空にできる（無期限・無制限に戻す） */
  check(/expires_at: \(typeof b\.expiresAt === "string" && b\.expiresAt\.trim\(\)\)[\s\S]{0,120}: null,/.test(own),
    "期限を空にしたら、無期限に戻る");

  check(/data-testid="coupon-edit-open"/.test(ownc), "編集の札がある");
  check(/data-testid="coupon-delete"/.test(ownc), "削除の札がある");
  /* 押せてしまうと「押したのに断られた」になる。はじめから出さない */
  check(/\(c\.usedEver \?\? 0\) === 0 \? \(/.test(ownc), "使われたクーポンには、削除の札を出さない");
  check(/使われたクーポンは削除できません/.test(owncTxt), "なぜ消せないかを、その場に書く");
  check(/coupon-edit-locked/.test(ownc), "使われたら、コードと値引きの欄を出さない");
  check(/すでに使われた分のお支払い額は変わりません/.test(owncTxt),
    "率を変えても、過去のお支払いは動かないと書いてある");

  /* ── 月別（げんきさん 2026-09-10）──
       「クーポンと広告費を月別に見れるようにする」
       「更に支払い先毎で月別に見れるようにもする」
     広告費は月ぎめで払う。月の切れ目は**日本の時計**で決める。
     世界標準時のまま切ると、1日の朝に使われたぶんが前の月に落ちて、
     払う額が変わる（数え方は tests/coupon.ts が見ている） */
  check(/monthKeyJst\(u\.used_at\)/.test(own), "月は、日本の時計で切る");
  check(/months: sortMonths\(allMonths\)/.test(own), "全体の月別を返す");
  check(/months: sortMonths\(months\)/.test(own), "クーポンごとの月別を返す");
  check(/months: sortMonths\(partnerMonths\.get/.test(own), "支払先ごとの月別を返す");
  /* 数えるのはサーバの1か所だけ。画面で足し直すと、同じ月なのに
     場所によって違う額が出る */
  check(!/reduce\([^)]*month/i.test(ownc), "画面で月を数え直していない");
  check(/testId="coupon-months-all"/.test(ownc), "全体の月別が画面にある");
  check(/testId="coupon-months-one"/.test(ownc), "クーポンごとの月別が画面にある");
  check(/testId="coupon-months-partner"/.test(ownc), "支払先ごとの月別が画面にある");
  /* 3か所とも同じ形。別々に書くと、片方だけ列が増えて読み比べられない */
  check((ownc.match(/<Months/g) ?? []).length === 3 && /function Months\(/.test(ownc),
    "月別の並びは1つの部品（3か所で同じ形）");

  /* ── コピーと、配るための絵（げんきさん 2026-09-10）──
       「クーポン画面でクーポンコードのコピーと、クーポン画像作成機能」 */
  check(/<CopyBtn/.test(ownc) && /coupon-copy/.test(ownc), "コードをコピーできる");
  const cb = read("src/components/ui/CopyBtn.tsx");
  check(/navigator\.clipboard/.test(cb) && /catch/.test(cb),
    "写せない相手には、そう出す（黙って失敗させない）");

  const art = read("src/components/owner/drawCoupon.ts");
  check(/export function drawCoupon/.test(art), "クーポンの絵を描くところがある");
  check(/coupon-art-save/.test(ownc), "作った絵を保存できる");
  /* **外に出る絵。**渡した相手が読む。こちらの取り分は載せない */
  check(!/reward|rewardRate|partner/i.test(art), "絵に広告費と支払先を載せない");
  check(!/maxUses|companyUses/.test(art), "絵に利用回数の上限を載せない");
  check(/期限なし/.test(art), "期限が無いときも、そう書く（空欄にしない）");
  const artBox = ownc.slice(ownc.indexOf("function CouponArtBox"), ownc.indexOf("export function CouponClient"));
  check(!/rewardRate|partnerId/.test(artBox), "絵に渡す中身にも、広告費と支払先を入れない");
}

console.log("── 支払期限と、記録の取りこぼし（げんきさん 2026-09-11）──");
{
  /* ── 支払期限（げんきさん 2026-09-11）──
       「支払い期限は請求書発行から1週間後。
         支払い確認が取れなければ受講不可」

     前は同じ取引について画面ごとに違うことを言っていた。
     特商法には「支払期限は定めていません」、申込みの画面の上にも
     「設けていません」、なのに同じ画面の下の履歴には日付が出ていた。
     支払時期は特商法の必須記載なので、1つに揃える */
  const pricing = read("src/lib/pricing.ts");
  check(/export const DUE_DAYS = 7;/.test(pricing), "支払期限は1週間");
  /* **日本の日付で切る。**世界標準時のまま切ると、朝9時前に
     申し込んだ人の期限が1日手前になる（境目は tests/pricing.mts） */
  check(/export function dueDateStr/.test(pricing), "期限は日本の日付で切る");
  /* **期限を出す所を2つ持たない。**片方だけ直すと、画面と請求書で
     違う日付が出る。日付を作るのは dueDateStr だけ */
  check(!/export function dueDate\(/.test(pricing), "期限を作る所は1つだけ");
  for (const f of ["src/app/api/order/route.ts", "src/app/api/train-order/route.ts"]) {
    check(/dueDateStr\(/.test(read(f)) && !/dueDate\(new Date\(\)\)\.toISOString/.test(read(f)),
      `${f.split("/").slice(-2)[0]} は日本の日付で期限を入れる`);
  }

  const legal2 = read("src/content/legal.ts");
  check(!/支払期限は定めていません/.test(strip(legal2)), "特商法に「定めていません」と書かない");
  check(/請求書の発行から1週間以内/.test(legal2), "特商法に、1週間と書く");
  check(/お振込みの確認が取れない場合、受講いただけません/.test(legal2),
    "確認が取れなければ受講できない、と書く");
  const oc2 = read("src/app/order/OrderClient.tsx");
  check(!/支払期限は設けていません/.test(oc2), "申込みの画面に「設けていません」と書かない");
  check(/支払期限は、請求書の発行から1週間です/.test(oc2), "申込みの画面にも、1週間と書く");
  const terms2 = read("src/app/legal/terms/page.tsx");
  check(/支払期限は請求書の発行から1週間/.test(terms2), "規約にも、1週間と書く");
  const invc2 = read("src/app/owner/invoice/[orderId]/InvoiceClient.tsx");
  check(/data-testid="invoice-due"/.test(invc2) && /o\.due \? day\(o\.due\)/.test(invc2),
    "請求書に、その申込みの期限の日付を出す");
  /* 決めたからには、過ぎたことが分からないと動けない */
  check(/overdue\(o\.due_date\)/.test(read("src/app/owner/OwnerClient.tsx")),
    "期限を過ぎた申込みが、運営の一覧で分かる");

  /* ── カード払いの入金が、静かに消えていた（2026-09-11）──
     Stripe は 200 を受け取ると二度と送ってこない。読み書きに失敗したまま
     200 を返すと、**カードは切れているのに入金が立たず、受講コードも出ない。**
     記録にも残らないので、あとから誰も気づけない */
  const hook = read("src/app/api/stripe/webhook/route.ts");
  check(/error: readErr/.test(hook), "注文を読めたかどうかを見る");
  check(/error: payErr/.test(hook), "入金を立てられたかどうかを見る");
  check((hook.match(/status: 503/g) ?? []).length >= 3,
    "失敗したら 5xx を返す（Stripe に送り直させる）");
  check((hook.match(/console\.error/g) ?? []).length >= 3, "失敗を記録に残す");
  /* 0件は正しいこともある（二度目の知らせ）。入金待ちが残っているかで見分ける */
  check(/入金待ちが残ったまま立たなかった/.test(hook), "0件を、いつも成功にしない");
  /* **要る枚数で見る。**0件で断ると、席を出さない申込みで送り直しが終わらない */
  check(/want > 0 && made === 0/.test(hook), "席が要るのに出せなかったときだけ断る");

  /* ── 記録が黙って欠ける（2026-09-11）──
     元請や監督署に出すのはサーバの記録。残せなかったら、その場で伝える */
  const uv = read("src/lib/useVerification.ts");
  check(!/\}\)\.catch\(\(\) => \{\}\);/.test(uv.slice(uv.indexOf("function logOk"))),
    "本人確認の控えの返事を、捨てない");
  check(/logNg/.test(uv) && /return \{ cam[^}]*logNg \}/.test(uv), "残せなかったことを画面に返す");
  check(/data-testid="verify-log-ng"/.test(read("src/app/edu/[courseId]/[lessonId]/LessonClient.tsx")),
    "残せなかったことを、受講中の画面に出す");

  const ex = read("src/app/api/exam/route.ts");
  check(/error: countErr/.test(ex), "受験回数を読めたかどうかを見る");
  check(/saved: mode === "supabase"/.test(ex), "記録が残ったかどうかを返す");
  const exc = read("src/app/edu/[courseId]/exam/ExamClient.tsx");
  check(/result\.saved === false/.test(exc), "画面が、それを見る");
  check(/data-testid="exam-not-saved"/.test(exc), "残っていないことを、その場で伝える");
  check(/修了証を発行できません/.test(strip(exc)), "このままでは修了証が出ない、と書く");

  /* ── 実務トレーニングの申込み（2026-09-11）──
     お金が動く画面なのに、法務の表記へ行けなかった */
  const to = read("src/app/train/TrainOrderClient.tsx");
  check(/href="\/legal\/tokushoho"/.test(to), "実務トレーニングの申込みから、特商法へ行ける");
  check(/href="\/legal\/terms"/.test(to) && /href="\/legal\/privacy"/.test(to),
    "規約と個人情報の取扱いへも行ける");
  const ps = read("src/lib/price.server.ts");
  check(/実務トレーニング 利用権/.test(ps), "実務トレーニングの値段も、特商法に載せる");
  check(/BRAND\.training/.test(ps), "売っている店でだけ載せる");
}

console.log("── 残っていた壁を全部（げんきさん 2026-09-11「他は全て修正して」）──");
{
  /* ── 修了証の照会：読めなかったら「無い」と言わない ──
     元請や労働基準監督署が番号を打ち込む窓口。データベースが一時的に
     断っただけで「その番号は存在しません」と答えると、本物を偽物だと言うことになる */
  const vc = read("src/app/api/verify-cert/route.ts");
  check(/const \{ data, error \} = await supabase\s*\.from\("certificates"\)/.test(vc), "照会は、読めたかどうかを見る");
  check(/unavailable: true/.test(vc) && /status: 503/.test(vc), "読めなかったら 503 で、そう言う（掛け直せば通る）");
  check(!/if \(!data\) return NextResponse\.json\(\{ found: false \}\);[\s\S]*error/.test(vc.split("if (error)")[0]),
    "「無い」と言う前に、読めたかどうかを見ている");

  /* ── 個人情報保護法で足りなかった3点 ── */
  const pv = strip(read("src/app/legal/privacy/page.tsx"));
  check(/代表者　\{s\.ceo/.test(pv), "個人情報の取扱いに、代表者の氏名がある（第32条）");
  check(/t="安全管理措置"/.test(pv), "安全管理措置の条項がある（第32条）");
  check(/アメリカ合衆国/.test(pv) && /日本国内（東京）/.test(pv), "保管国と、経由する国を書いてある（第28条）");
  check(/包括的な法制度はなく/.test(pv), "その国の制度についても書いてある");

  /* ── 特商法：カードの有無で出し分け・特別の販売条件・改定日 ── */
  const lg = read("src/content/legal.ts");
  check(/export const LEGAL_REVISED = "20\d\d年\d{1,2}月\d{1,2}日";/.test(lg), "直した日を1か所で持つ");
  check(!/LEGAL_REVISED = "2026年8月24日"/.test(lg), "直した日が、制定日のままではない");
  check(/card \? "クレジットカード、または銀行振込（請求書払い）" : "銀行振込（請求書払い）"/.test(lg),
    "支払方法は、カードの有無で出し分ける（入れた瞬間に虚偽にならない）");
  check(/k: "特別の販売条件"/.test(lg) && /受講コードは発行から1年で失効/.test(lg), "特別の販売条件がある");
  const tp = read("src/app/legal/tokushoho/page.tsx");
  check(/tokushoho\(allPrices\(\), \{ card: hasStripe\(\), maxSeats: MAX_SEATS \}\)/.test(tp),
    "出し分けの元は、画面と同じ判定（hasStripe）");
  for (const f of ["tokushoho", "terms", "privacy"]) {
    const pg = read(`src/app/legal/${f}/page.tsx`);
    check(/export const dynamic = "force-dynamic";/.test(pg), `${f} は作り置きにしない（環境変数が反映される）`);
    check(/updated=\{LEGAL_REVISED\}/.test(pg), `${f} の日付は1か所から`);
  }
  check(/hasStripe\(\) \? "クレジットカードまたは" : ""/.test(read("src/app/legal/terms/page.tsx")),
    "規約の支払方法も、同じ判定で出し分ける");
  check(/改定/.test(read("src/components/legal/Page.tsx")), "直した日を「改定」として出す");

  /* ── 開発用の逃げ道を、本番で塞ぐ ──
     サーバは実経過で頭打ちにするので水増しにはならないが、
     本番の受講者に「＋1分（開発用）」が見えていた。
     確認問題は、通信不調で端末内合格になり「合格したのに修了証が出ない」に行き着いていた */
  const lc2 = read("src/app/edu/[courseId]/[lessonId]/LessonClient.tsx");
  check(/process\.env\.NODE_ENV !== "production" && s\.mode === "local" && loaded/.test(lc2),
    "「＋1分」の札は、本番の組み立てでは消える");
  const pc = read("src/lib/progressClient.ts");
  check(/const prod = process\.env\.NODE_ENV === "production";/.test(pc) && /if \(prod\) \{/.test(pc),
    "本番では、サーバに残らない合格を作らない");
  check(/ログインが切れています。合格を記録できない/.test(strip(pc)), "切れているなら、そう言う");

  /* ── 消費税の端数は、1つの請求書につき1回（インボイス制度）──
     パーセント型のクーポンで、行ごとに切ると1円ずれていた */
  const cp = read("src/lib/coupon.ts");
  check(/export function groupAmounts/.test(cp), "税額を申込みまるごとで1回決めて、行に配る");
  check(!/export function lineAmount/.test(cp), "行ごとに税を切る関数は残さない（2つの流儀を持たない）");
  check(/const tax = Math\.floor\(net \* TAX_RATE\);/.test(cp), "端数を落とすのは合計に対して1回");
  const or2 = read("src/app/api/order/route.ts");
  check(/const money = groupAmounts\(/.test(or2) && /amount: money\.amounts\[i\]/.test(or2), "注文の行の額は、その配り方で入れる");
  const iv = read("src/app/api/owner/invoice/route.ts");
  check(!/Math\.round\(a \/ \(1 \+ TAX_RATE\)\)/.test(iv), "請求書は税込から割り戻さない（端数を背負った行が1円ずれる）");
  check(/const gross = unit \* qty;/.test(iv), "税抜は単価×人数から出す");
  check(/data-testid="invoice-taxable"/.test(read("src/app/owner/invoice/[orderId]/InvoiceClient.tsx")),
    "「10%対象」の行がある（税率ごとに区分した対価の額）");

  /* ── LINE：ブロックされたら送るのをやめる ── */
  check(/export async function unlinkLineId/.test(read("src/lib/lineBot.server.ts")), "結び付きを外す口がある");
  const wh = read("src/app/api/line/webhook/route.ts");
  check(/ev\?\.type === "unfollow"/.test(wh) && /unlinkLineId\(/.test(wh), "unfollow を受けて、結び付きを外す");

  /* ── そのほか ── */
  check(/try \{\s*session = await stripe\.checkout\.sessions\.create/.test(read("src/app/api/stripe/checkout/route.ts")),
    "Stripe が断ったら、見当違いの文を出さずにそう言う");
  check(/error: nameErr/.test(read("src/app/api/cert/route.ts")), "修了証の氏名の保存に失敗したら、先へ進まない");
  const envx = read(".env.example");
  for (const v of ["OWNER_EMAILS","SEAT_UNIT_PRICE","TRAIN_UNIT_PRICE","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET","SITE_URL","NEXT_PUBLIC_SITE_URL","CERT_ISSUER_NAME","NEXT_PUBLIC_BRAND"]) {
    check(new RegExp(`^${v}=`, "m").test(envx), `.env.example に ${v} がある`);
  }
  check(!/console\.log\(/.test(read("src/app/api/mypage/route.ts")), "マイページの口に計測の console.log を残さない");

  /* 検索窓で「足場」「職長」と打つと0件になっていた（docs/92 §4） */
  const ocs = read("src/components/OtherCourses.tsx");
  check(/main\?: CourseMeta\[\];/.test(ocs) && /data-testid="other-main-hit"/.test(ocs), "大きな札の講座も、打てば当たる");
  check(/typed \? main\.filter/.test(ocs), "空の窓では出さない（上に既に有る）");
  check(/main=\{mainCourses\}/.test(read("src/app/page.tsx")), "ホームが、大きな札の講座を探す窓に渡す");
  check(/main=\{r\.main\}/.test(read("src/app/edu/page.tsx")), "講座の一覧も渡す");

  /* ── 読めなかったことを「0件」に化けさせない（docs/100）を、口ぜんぶで ──
     2026-09-10 の点検で 61か所残っていた。1か所も残さない */
  const apiFiles: string[] = [];
  const walk4 = (d: string) => {
    for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk4(`${d}/${e.name}`);
      else if (e.name.endsWith(".ts")) apiFiles.push(`${d}/${e.name}`);
    }
  };
  walk4("src/app/api");
  const silent: string[] = [];
  for (const f of apiFiles) {
    const src = read(f);
    for (const m of src.matchAll(/const \{ data([^}]*)\} = await /g)) {
      if (!/error/.test(m[1])) silent.push(`${f}: ${m[0].slice(0, 40)}`);
    }
  }
  check(silent.length === 0, `口の読み取りで、失敗を受け取っていない所が無い（${silent.length}件${silent.length ? "：" + silent.slice(0, 3).join(" ／ ") : ""}）`);
  check(/throw new Error\(`取得済みの資格を読めませんでした/.test(read("src/lib/quals.ts")), "取得済みの資格も、読めなかったら「無い」と言わない");
}

console.log("── 下の行き先と、お知らせの出し方 ──");
{
  /* げんきさん（2026-09-09）
       「おしらせは確認したら表示しない」
       「画面下部にメニュー表示して固定する」
       「マイページ…実際に受講可能な講座のみを表示する」
       「取得済みの資格講座をたっぷすると『取得済みのため受講不要』と表示させる」 */
  /* ホームの「おしらせ」は、読んでいないものがあるときだけ。
     読んだものはマイページに残す（げんきさん 2026-09-09） */
  const no = read("src/components/Notices.tsx");
  check(/mode === "unread" && unread === 0\) return null;/.test(no),
    "読んだあとは、ホームから消える");
  const mec = read("src/app/me/MeClient.tsx");
  check(/<Notices mode="all" \/>/.test(mec), "読んだ知らせは、マイページで読み返せる");

  /* 知らせで画面をふさがない。読みたいときに /updates を開く */
  const un = read("src/components/UpdateNotice.tsx");
  check(/return null;/.test(un) && !/fixed inset-0/.test(un), "知らせは自分からは出さない");
  const home = read("src/app/page.tsx");
  check(/href="\/updates"/.test(home), "ホームに「更新のお知らせ」の入口がある");

  const nav = read("src/components/BottomNav.tsx");
  const css = read("src/app/globals.css");
  /* ── 貼り付けるのをやめた（げんきさん 2026-09-11）──
     「また下部タブがずれる。スクロールするとズレる。固定して」

     position: fixed で画面に貼り付けている限り、iOS の惰性スクロールでは
     札の位置を決めるのが合成側になり、慣性の間だけ取り残される。
     小さくしても、描画層を切り出しても（2026-09-10 にやった）、
     この道筋そのものは残る。

     だから**本体をスクロールさせない。**外枠を画面ぴったりの縦並びにして、
     真ん中の <main> だけを動かし、札はその並びのいちばん下に普通に置く。
     動かないものの隣にあるので、ずれようがない。
     貼り付けに戻したら、また同じことが起きる */
  check(!/fixed inset-x-0 bottom-0/.test(nav), "札を画面に貼り付けない（ずれる元）");
  check(!/translateZ|willChange/.test(nav), "描画層の細工に頼らない（貼り付けをやめたので要らない）");
  check(/dataset\.shell = "fixed"/.test(nav), "札が出ている間だけ、本体を止める印を立てる");
  check(/delete el\.dataset\.shell/.test(nav), "画面を移ったら印を外す（次の画面が動かなくなる）");
  const shell = read("src/app/layout.tsx");
  check(!/transform|will-change|backdrop-blur/.test(shell),
    "外側の入れ物に transform を掛けない（掛けると固定が壊れる）");
  check(/print:hidden/.test(nav), "紙には出さない（請求書）");

  /* ── iPhone の下の横棒と重ならないか（げんきさん 2026-09-10）──
     「下記タブが小さくてiPhoneのバーと被って変な挙動する」。
     env(safe-area-inset-bottom) で余白は取っていたが、
     **viewport-fit=cover が無いと env は 0 になる。**
     ホーム画面から開いたときだけ、横棒が札の字に乗っていた。
     どちらか片方だけでは直らないので、両方を見る */
  check(/viewportFit: "cover"/.test(shell), "画面のふちまで使うと宣言する");
  check(/padding-top: env\(safe-area-inset-top\)/.test(css),
    "ふちまで使うぶん、上は時計のぶんを空ける（cover と組で持つ）");
  check(/max\(env\(safe-area-inset-bottom\), \d+px\)/.test(nav),
    "下は、env が 0 の相手でも必ず空ける");
  check(/const ROW = (\d+)/.test(nav) && Number(RegExp.$1) >= 44,
    `押す所は 44px 以上（いま ${(nav.match(/const ROW = (\d+)/) ?? [])[1]}px）`);

  /* ── 外枠の作り（2026-09-11）──
     本体を止めて、真ん中だけを動かす。3つが揃っていないと成り立たない。
     min-height: 0 が抜けると、中身の高さぶんまで伸びて末尾が切れる */
  check(/:root\[data-shell="fixed"\][\s\S]{0,400}overflow: hidden/.test(css),
    "印が立っている間は、本体を止める");
  check(/:root\[data-shell="fixed"\] \.shell > main[\s\S]{0,200}overflow-y: auto/.test(css),
    "動くのは真ん中だけ");
  check(/:root\[data-shell="fixed"\] \.shell > main[\s\S]{0,200}min-height: 0/.test(css),
    "真ん中に min-height: 0 を入れる（無いと末尾が切れる）");
  /* **紙のときは必ず戻す。**止めたまま刷ると、請求書が1枚目で切れる */
  const printBlock = css.slice(css.indexOf("@media print"));
  check(/data-shell="fixed"[\s\S]{0,300}overflow: visible/.test(printBlock),
    "紙では、止めた本体を戻す（請求書が1枚目で切れる）");
  check(/path\.startsWith\("\/training"\)/.test(nav), "実務トレーニングでは出さない");
  check(/\/\^\\\/edu\\\/\[\^\/\]\+\\\/\.\+\//.test(nav) || /edu\\\//.test(nav),
    "単元や修了試験の途中では出さない");
  const navlib = read("src/lib/nav.ts");
  check(/me\?\.owner/.test(navlib) && /me\?\.admin/.test(navlib), "立場によって行き先が変わる");
  const lay = read("src/app/layout.tsx");
  check(/<BottomNav \/>/.test(lay), "どの画面にも出る（layout に置く）");
  /* 立場はサーバが決める（OWNER_EMAILS）。画面で作らない */
  check(!/owner: true/.test(nav) && /loadMe\(\)/.test(nav), "立場は /api/me が返すものを使う");
  const hc = read("src/components/HomeCards.tsx");
  check(/!me\.admin && !me\.owner/.test(hc), "配る側には「受講するには」を出さない");

  /* ── ホームと下の札を重ねない（げんきさん 2026-09-10）──
       「ホームと下部タブで重複するものはホームに出さない」
     同じ行き先が1画面に2つ並ぶと、どちらを押せばいいのか分からない。
     **並びを決める所は1つ**にして、ホームはそれを見て消す */
  check(/navItems/.test(nav) && !/const out: (Item|NavItem)\[\]/.test(nav),
    "下の札の並びは src/lib/nav.ts が決める（2か所に書かない）");
  check(/export function inNav/.test(navlib), "その行き先が下に出ているか聞ける");
  for (const [href, why] of [
    ["/me", "マイページ"], ["/admin", "受講管理"], ["/owner", "運営"],
  ] as const) {
    check(new RegExp(`inNav\\(me, "${href}"\\)`).test(hc),
      `ホームの「${why}」は、下に出ていないときだけ出す`);
  }
  /* 下に出ている行き先を、ホームが決め打ちで札にしていないか。
     講座（/edu）はホームに札が無い（各講座へ直接飛ぶ） */
  const homeAll = read("src/app/page.tsx") + hc + read("src/components/FirstSteps.tsx");
  check(!/href="\/edu"/.test(homeAll), "ホームに講座の一覧の札を置かない（下に出ている）");
  /* 帯の名前も、押せばマイページだった。**同じ行き先が3つ**あった */
  const barc = read("src/components/AccountBar.tsx");
  check(!/href="\/me"/.test(barc), "帯の名前は押せない（マイページは下の札から）");
  check(/data-testid="account-name"/.test(barc), "帯には、いま誰かが出る");
  /* 請求書は、いちばん急ぐ用。**はじめかたのすぐ下**に出す */
  check(!/data-testid="home-bill"/.test(hc), "請求書の札は、下のほうの並びから外してある");
  check(/<BillCard \/>/.test(home) && home.indexOf("<BillCard") > home.indexOf("<FirstSteps"),
    "請求書は、はじめかたのすぐ下に出る");

  /* ── 教育担当者の付け外し（げんきさん 2026-09-09）──
     「教育担当者が1人しか居ない場合には外すが出来ないようにする」
     「外す、担当者にするをタップした場合には
       確認画面表示→完了表示 ポップアップで」 */
  /* ── 受講コードの枚数（げんきさん 2026-09-10）──
     「配ってないコードが3件とあるが、未使用は15件ある」
     1講座に絞って数えていたのが原因。会社ぶん全部で数える */
  const sum = read("src/app/api/admin/summary/route.ts");
  check(/paidAll/.test(sum), "入金済みは、会社ぶん全部の注文で見る");
  check(/wallet/.test(sum), "枚数は allOrders から数える");
  check(/seats: \{ paid: wallet\.paid, used: wallet\.used, free: wallet\.free \}/.test(sum),
    "買った・配った・残りの3つを返す");
  const ad = read("src/app/admin/AdminClient.tsx");
  check(/st\.seats\.free/.test(ad), "残り枚数を出す");
  /* 配るのは名簿。枚数の一覧へ戻しても配れない
     （げんきさん 2026-09-10「配るを押してまだ配ってない受講コードに
     遷移するのはおかしい」） */
  check(/admin-give/.test(ad), "残りがあれば、配る所へ飛べる");
  check(/href="#roster"/.test(ad) && /id="roster"/.test(ad), "飛び先は名簿");
  check(!/href="#codes"/.test(ad), "枚数の一覧へは戻さない");
  check(/admin-drills-open/.test(ad), "実技の案内は畳んで出す");

  const card = read("src/app/admin/LearnerCard.tsx");
  check(/canDropAdmin/.test(card), "1人しか居ないときは、外す所を出さない");
  check(/admin-role-last/.test(card), "外せない理由を、その場に書く");

  const ac = read("src/app/admin/AdminClient.tsx");
  check(/admins > 1/.test(ac), "担当者の数を数えて渡す");
  check(/setAsk\(\{/.test(ac), "押した瞬間には変えない（先に確かめる）");
  check(/<AskDone/.test(ac), "確かめる札を出す");

  const ask = read("src/components/AskDone.tsx");
  check(/ask-done-yes/.test(ask) && /ask-done-no/.test(ask), "やる・やめるが分かれている");
  check(/ask-done-done/.test(ask), "終わったことを出す");
  check(/setDone\(true\)/.test(ask), "うまくいったときだけ「終わった」に進む");

  /* サーバも同じことを断る。**画面だけで守らない** */
  const role = read("src/app/api/admin/role/route.ts");
  check(/count \?\? 0\) <= 1/.test(role), "サーバも、最後の1人は外させない");

  const me = read("src/app/me/MeClient.tsx");
  /* 受講の欄は、これからやることだけ（げんきさん 2026-09-10）。
     修了したものも、外部で取得したものも、下の「取得済みの資格」に出る */
  check(/\(c\.hasSeat \|\| c\.started\) && !c\.cert/.test(me),
    "受講の欄は、これからやる講座だけ出す");
  /* しぼっている行だけを見る。「取得済みのため受講不要」を出す所では
     held を見てよい（受け始めた講座に印を付けるため） */
  /* ── マイページの分け方（げんきさん 2026-09-10）──
     「取得済みはマイページの受講には表示しない」
     「取得済み資格は下部の取得済みの資格に表示。
       システムで取得した資格はここからも修了証が出せる」
     「取得済みの資格は閉じておく。展開式にする」 */
  check(!/取得済みのため受講不要/.test(strip(me)), "「受講不要」の札は出さない");

  /* ── 受講の欄には、取得済みを出さない（げんきさん 2026-09-10）──
     「取得済みなのに『続きから受講』と表示されてる」 */
  check(/!held\.has\(c\.courseId\)/.test(me), "外部で取得したものも、受講の欄に出さない");
  /* ホーム画面のアプリの枠は、ログイン後のポップアップに移した */
  check(!/me-handoff/.test(me), "マイページに、コードを作る枠は置かない");
  /* どのLINEと繋がっているか（0037） */
  check(/st\.lineName/.test(me), "繋がっているLINEの名前を出す");
  /* つなぎ直す道（げんきさん 2026-09-10「LINEをつなぐが無い」）。
     スマホやLINEを替えたとき、移せないと知らせが届かない */
  check(/me-line-relink/.test(me), "つながっていても、つなぎ直せる");
  const my = read("src/app/api/mypage/route.ts");
  check(/lineName/.test(my), "表示名を返す");
  const bot = read("src/lib/lineBot.server.ts");
  check(/display_name/.test(bot), "結ぶときに表示名も残す");

  const hq = read("src/app/me/HeldQuals.tsx");
  check(/<details/.test(hq), "取得済みの資格は畳んで出す（展開式）");
  check(/me-quals-open/.test(hq), "押して開く所がある");
  check(/me-qual-cert/.test(hq), "この仕組みで取ったものは、ここから修了証を受け取れる");
  const quals = read("src/app/api/quals/route.ts");
  check(/courseId: cid/.test(quals), "修了証へ行くのに要る講座を返す");

  const meFilter = me.split("\n").find((l) => l.includes("st.learning.filter")) ?? "";
  check(!!meFilter && !/held\.has/.test(meFilter),
    "取得済み（自己申告）だけの講座は、やることの一覧に出さない");
  check(!!meFilter && !/\bc\.cert\b(?!\))/.test(meFilter.replace("!c.cert", "")),
    "受講の欄に、修了した講座は出さない");
  check(/data-testid="me-find-course"/.test(me), "ほかの講座を探す道は残す");
  const mp = read("src/app/api/mypage/route.ts");
  check(/heldCourseIds\(supabase, \[user\.id\]\)/.test(mp), "外部で取得した講座も返す");
  const ll = read("src/app/edu/[courseId]/LessonList.tsx");
  check(/<HeldNotice courseId=\{course\.id\} \/>/.test(ll), "講座を開いた所にも、持っていることを出す");

  /* ── 「受講不要」と書いてよい場所は、1つだけ ──

     げんきさん 2026-09-09
       「受講不要がまだ表示されてる」
     げんきさん 2026-09-11
       「取得済みでも押すと講座リクエスト可能になるから、
         取得済み資格はタップで開いたら取得済みの為受講不要などと表示する」

     一見ぶつかっているが、立っている場所が違う。

       受けられる人（受講コードがある）… 受けるかどうかは本人と会社が決める。
         こちらが「要らない」と言い切らない。持っていることだけ伝える
       受けられない人（コードが無い）… そのままでは担当者に
         「受けたい」と頼む札が出る。もう持っている資格を頼ませない。
         ここは、はっきり不要と書いて止める

     だから **HeldInstead だけが書いてよい。**
     ほかの画面に増えたら止める。 */
  const uiFiles: string[] = [];
  const walk3 = (d: string) => {
    for (const e of readdirSync(new URL(`../${d}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk3(`${d}/${e.name}`);
      else if (e.name.endsWith(".tsx")) uiFiles.push(`${d}/${e.name}`);
    }
  };
  for (const d of ["src/app", "src/components"]) walk3(d);
  const MAY_SAY = "src/components/HeldInstead.tsx";
  const noNeed = uiFiles.filter((f) =>
    f !== MAY_SAY && /受講不要|受講の必要はありません|受講は不要/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, "")));
  check(noNeed.length === 0, `ほかの画面に「受講不要」と書かない（${noNeed.join(" ／ ") || "無し"}）`);

  /* 持っている人には、受講リクエストの札そのものを出さない。
     **言葉で止めるだけでは足りない。**押せれば押される */
  const hi = read(MAY_SAY);
  check(/受講は不要です|受講の必要はありません/.test(strip(hi)), "取得済みの画面には、不要だと書く");
  check(!/RequestCourse/.test(strip(hi)), "取得済みの画面に、受講リクエストを置かない");
  const ns = read("src/components/NeedSeat.tsx");
  check(/<HeldInstead>/.test(ns) && /<\/HeldInstead>/.test(ns),
    "断りの画面は、取得済みの人には差し替える");
  /* マイページへ戻す道を残す。よそで取った資格は本人が登録するので、
     押し間違いがある。黙って行き止まりにしない */
  check(/href="\/me"/.test(hi), "登録を直しに行ける（間違って登録していたとき）");
}

console.log(`\n通り ${ok} ／ だめ ${ng}`);
process.exit(ng ? 1 : 0);
