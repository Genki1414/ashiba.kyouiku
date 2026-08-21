/* サーバ記録モード（Supabase 接続時）の検証。
   視聴時間の頭打ち・規定時間の判定・照合ログ・修了試験の記録が
   実際に DB の行になることを、DB を直接見て確かめる。

   実行手順（この環境では PostgREST 互換 shim を使う）:
     su postgres -c "pg_ctl -D <data> -o '-k <dir> -c listen_addresses=127.0.0.1 -p 55432' start"
     psql -d appdb -f supabase/tests/00-supabase-shim.sql -f supabase/apply-all.sql
     node tests/postgrest-shim.mjs 54321 postgres://postgres@127.0.0.1:55432/appdb
     # .env.local に shim を指す設定を書いて
     npm run dev -- -p 3100
     node tests/supabase-mode.mjs

   本物の Supabase に対して実行する場合は PG_URL を接続文字列にする。 */
import pg from "pg";

const BASE = process.env.BASE ?? "http://localhost:3100";
const PG_URL = process.env.PG_URL ?? "postgres://postgres@127.0.0.1:55432/appdb";
const ENROLLMENT = "55555555-5555-5555-5555-555555555555";
const die = (m) => { console.error("NG:", m); process.exit(1); };
const post = async (p, b) => {
  const r = await fetch(`${BASE}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  });
  return { status: r.status, json: await r.json() };
};

const db = new pg.Client({ connectionString: PG_URL });
await db.connect();
// 前回の残りを消してから始める
await db.query("delete from progress where enrollment_id = $1", [ENROLLMENT]);
await db.query("delete from verify_logs where enrollment_id = $1", [ENROLLMENT]);
await db.query("delete from exams where enrollment_id = $1", [ENROLLMENT]);

// 1) 接続確認
const health = await (await fetch(`${BASE}/api/health`)).json();
if (health.mode !== "supabase") die(`mode=${health.mode}（supabase のはず）。.env.local を確認`);
if (!Object.values(health.checks).every((c) => c.ok)) die("health のチェックに失敗あり");
console.log("OK: /api/health がサーバ記録モードを報告");

// 2) 単元を開く（進捗行がここで作られる）→ 実際に見た時間ぶんだけ加算される
await fetch(`${BASE}/api/progress?lessonId=1-1`);
await new Promise((r) => setTimeout(r, 5000));
const a = await post("/api/progress", { lessonId: "1-1", deltaSec: 5 });
if (a.json.watchedSec !== 5) die(`初回の加算が ${a.json.watchedSec}（5のはず。開いた時刻から数えられていない）`);
console.log("OK: 単元を開いてから5秒見た分が、初回同期でも取りこぼされない");

// 3) 申告を盛っても実経過で頭打ち
await new Promise((r) => setTimeout(r, 2000));
const b = await post("/api/progress", { lessonId: "1-1", deltaSec: 300 });
if (b.json.watchedSec > 12) die(`300秒の申告が通ってしまった（${b.json.watchedSec}秒）`);
console.log(`OK: 300秒と申告しても実経過ぶんだけ加算（${a.json.watchedSec} → ${b.json.watchedSec}秒）`);
const over = await post("/api/progress", { lessonId: "1-1", deltaSec: 100000 });
if (over.status !== 400) die("桁外れの申告が API で弾かれない");
console.log("OK: 桁外れの申告は API が拒否");
const rowP = (await db.query("select watched_sec from progress where enrollment_id=$1 and lesson_id='1-1'", [ENROLLMENT])).rows[0];
if (!rowP || rowP.watched_sec !== b.json.watchedSec) die("progress 行が API の値と一致しない");
console.log("OK: progress 行が DB に入っている");

// 3) 規定時間に達するまで合格にできない
const q = await post("/api/quiz", { lessonId: "1-1" });
if (q.status !== 409 || !q.json.error.includes("規定時間")) die(`規定時間の判定が効いていない（${q.status} ${JSON.stringify(q.json)}）`);
console.log("OK: 規定時間の未達を DB 側が拒否（409）");

// 4) 規定時間に達したら合格を記録できる
await db.query("update progress set watched_sec = 3000 where enrollment_id=$1 and lesson_id='1-1'", [ENROLLMENT]);
const q2 = await post("/api/quiz", { lessonId: "1-1" });
if (q2.status !== 200 || !q2.json.quizPassedAt) die(`合格を記録できない（${q2.status} ${JSON.stringify(q2.json)}）`);
const passedAt = (await db.query("select quiz_passed_at from progress where enrollment_id=$1 and lesson_id='1-1'", [ENROLLMENT])).rows[0].quiz_passed_at;
if (!passedAt) die("quiz_passed_at が DB に入っていない");
console.log("OK: 規定時間到達後は合格を記録（quiz_passed_at）");

// 5) 照合ログ（画像は送らない・結果と理由だけ）
for (const reason of ["no_face", "multi_face", "blocked", "no_motion"]) {
  const r = await post("/api/verify-log", { lessonId: "1-1", reason });
  if (r.status !== 200) die(`照合ログの記録に失敗（${reason}）`);
}
const bad = await post("/api/verify-log", { lessonId: "1-1", reason: "でたらめ" });
if (bad.status !== 400) die("不正な理由が通ってしまった");
const logs = (await db.query("select reason, result from verify_logs where enrollment_id=$1 order by created_at", [ENROLLMENT])).rows;
if (logs.length !== 4 || !logs.every((l) => l.result === "ng")) die(`verify_logs が想定と違う（${logs.length}件）`);
console.log("OK: 照合ログ4種を DB に記録（不正な理由は拒否）");

// 6) 修了試験：出題に正解が含まれない／採点はサーバ／exams に残る
const ex = await (await fetch(`${BASE}/api/exam`)).json();
if (ex.questions.length !== 20) die(`出題数が ${ex.questions.length}（20のはず）`);
if (ex.questions.some((x) => "ok" in x)) die("出題に正解（ok）が混ざっている");
console.log("OK: 出題20問に正解が含まれない");
const r1 = await post("/api/exam", { token: ex.token, answers: ex.questions.map(() => 0) });
if (r1.status !== 200 || typeof r1.json.score !== "number") die("採点に失敗");
const tampered = await post("/api/exam", { token: ex.token.slice(0, -2) + "xx", answers: ex.questions.map(() => 0) });
if (tampered.status !== 400) die("改ざんしたトークンが通ってしまった");
console.log(`OK: サーバ採点（${r1.json.score}/20・${r1.json.passed ? "合格" : "不合格"}）、改ざんトークンは拒否`);
const exams = (await db.query("select attempt, score, total, passed from exams where enrollment_id=$1 order by attempt", [ENROLLMENT])).rows;
if (exams.length !== 1 || exams[0].attempt !== 1 || exams[0].score !== r1.json.score) die("exams 行が想定と違う");
const r2 = await post("/api/exam", { token: (await (await fetch(`${BASE}/api/exam`)).json()).token, answers: Array(20).fill(0) });
const exams2 = (await db.query("select attempt from exams where enrollment_id=$1 order by attempt", [ENROLLMENT])).rows;
if (exams2.length !== 2 || exams2[1].attempt !== 2) die("2回目の受験で attempt が採番されない");
console.log("OK: exams に受験回（attempt）が採番されて残る");

// 7) 修了証は未入金なら発行できない（DBのトリガ）
try {
  await db.query("insert into certificates (enrollment_id, cert_no) values ($1, 'TEST-0001')", [ENROLLMENT]);
  die("未入金でも修了証が発行できてしまった");
} catch (e) {
  if (!e.message.includes("未入金")) die(`想定外のエラー: ${e.message}`);
  console.log("OK: 未入金では修了証を発行できない");
}

await db.end();
console.log("ALL OK");
