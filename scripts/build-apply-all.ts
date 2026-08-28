/* supabase/apply-all.sql を組み立てる。
   マイグレーションと lessons の投入を1ファイルにまとめ、
   Supabase の SQL Editor に一度貼るだけで初期化が終わるようにする。
   実行: npm run build:sql */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CurriculumSchema } from "../src/types/curriculum";
import { COURSES } from "../src/content/courses";

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf-8");
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/* 講座ごとの教材から lessons を作る。増やすときは COURSES に足すだけ */
const lessonRowsFor = (courseId: string, file: string) => {
  const cur = CurriculumSchema.parse(JSON.parse(read(`content/courses/${file}`)));
  const rows = cur.subjects.flatMap((s, si) =>
    s.lessons.map(
      (l, li) =>
        `  (${q(`${courseId}:${l.id}`)}, ${q(courseId)}, ${s.id}, ${q(l.title)}, ${l.legal_min}, ${si * 100 + li})`,
    ),
  );
  return { rows, n: rows.length };
};
const made = COURSES.filter((c) => c.ready).map((c) => lessonRowsFor(c.id, c.file));

/* マイグレーションは、書き並べずにフォルダから読む。
   ここに1本ずつ書いていたので、0019 を足したときに
   **NEED_SCHEMA だけ 0019 に上がって、中身は 0018 まで**になった。
   その apply-all.sql をいくら流しても /setup は赤いまま、
   直しようが無い、といういちばん困る形になる。 */
const migFiles = readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
if (!migFiles.length) throw new Error("supabase/migrations に .sql がありません");
const migList = migFiles.map((f) => f.replace(/\.sql$/, "")).join(" / ");
const migSql = migFiles.map((f) => read(`supabase/migrations/${f}`)).join("\n\n");

/* 講座（courses）も、ここから作る。

   0011 では 'ashiba' を1件、SQL に書き込んでいた。
   だから src/content/courses.ts に足しても**データベースには入らず**、
   その講座の受講も席も作れなかった（外部キーで弾かれる）。
   docs/13 には「courses と lessons に入る」と書いてあったが、
   入っていたのは lessons だけだった。

   準備中（ready:false）の講座も入れる。入れておかないと、
   教材ができた日に SQL を流し直すまで何も置けない。 */
const courseRows = COURSES.map(
  (c, i) =>
    `  (${q(c.id)}, ${q(c.name)}, ${q(c.basis)}, ${c.totalMin}, ${i + 1})`,
).join(",\n");
const lessonRows = made.flatMap((m) => m.rows).join(",\n");
const lessonCount = made.reduce((n, m) => n + m.n, 0);

const out = `-- ═══════════════════════════════════════════════════════════
-- 足場トレーニング Supabase 初期化（このファイルを SQL Editor に貼って実行）
--
-- 中身:
--   1. マイグレーション ${migList}
--   2. lessons（単元の規定時間）${lessonCount}件を投入
--
-- 何度実行しても壊れないように書いてある（作成済みなら飛ばす）。
-- 自動生成: npm run build:sql　— 直接編集しないこと
-- ═══════════════════════════════════════════════════════════

${migSql}

-- ═══════════════════════════════════════════════════════════
-- 3'. courses（src/content/courses.ts の写し）
--
-- 講座を足したときに、ここへ入らないと受講も席も作れない。
-- 準備中のものも入れておく（教材ができた日に流し直さなくて済む）。
-- ═══════════════════════════════════════════════════════════
insert into public.courses (id, name, basis, total_min, sort_order) values
${courseRows}
on conflict (id) do update
  set name       = excluded.name,
      basis      = excluded.basis,
      total_min  = excluded.total_min,
      sort_order = excluded.sort_order;

-- ═══════════════════════════════════════════════════════════
-- 4. lessons（curriculum.json の単元ID・題名・規定時間の写し）
-- ═══════════════════════════════════════════════════════════
insert into public.lessons (lesson_id, course_id, subject_id, title, legal_min, sort_order) values
${lessonRows}
on conflict (lesson_id) do update
  set course_id  = excluded.course_id,
      subject_id = excluded.subject_id,
      title      = excluded.title,
      legal_min  = excluded.legal_min,
      sort_order = excluded.sort_order;

-- ═══════════════════════════════════════════════════════════
-- 完了。
--
-- 開発用の種データ（開発テスト工業・受講テスト・DEV-0001）は、
-- ここには入れない。本番でこのファイルを流すと、買った覚えのない
-- 0円の注文が画面に出てしまうため。
-- 手元で使うときだけ supabase/seed.sql を別に流すこと。
-- ═══════════════════════════════════════════════════════════
select
  (select count(*) from public.courses)     as courses,
  (select count(*) from public.lessons)     as lessons,
  (select count(*) from public.enrollments) as enrollments,
  public.schema_version()                   as schema_version;
`;

writeFileSync(path.join(root, "supabase/apply-all.sql"), out);
console.log("OK  supabase/apply-all.sql を生成");

/* ── アプリが必要とする版を書き出す ──
   /api/health が「apply-all.sql を流したか」を見るのに使う。
   手で書いていたら 0010 のまま止まっていて、
   0011〜0015 を流していなくても「大丈夫」と出ていた。
   マイグレーションを足したら、ここが自動で上がる。 */
const need = migFiles.at(-1)!.slice(0, 4);

writeFileSync(
  path.join(root, "src/content/schema.ts"),
  `/* このアプリが必要とするデータベースの版。

   supabase/migrations の最後の番号。
   **手で書かないこと**（npm run build:sql が書き出す）。
   手で書いていたら 0010 のまま止まっていて、
   0011〜0015 を流していない人にも「大丈夫」と出ていた。 */

export const NEED_SCHEMA = ${JSON.stringify(need)};
`,
);
console.log(`OK  src/content/schema.ts を生成（${need}）`);

