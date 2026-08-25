/* supabase/apply-all.sql を組み立てる。
   マイグレーションと lessons の投入を1ファイルにまとめ、
   Supabase の SQL Editor に一度貼るだけで初期化が終わるようにする。
   実行: npm run build:sql */

import { readFileSync, writeFileSync } from "node:fs";
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
const lessonRows = made.flatMap((m) => m.rows).join(",\n");
const lessonCount = made.reduce((n, m) => n + m.n, 0);

const out = `-- ═══════════════════════════════════════════════════════════
-- 足場トレーニング Supabase 初期化（このファイルを SQL Editor に貼って実行）
--
-- 中身:
--   1. マイグレーション 0001_init / 0002_rls / 0003_rules / 0004_auth / 0005_cert / 0006_version / 0007_admin / 0008_tenant / 0009_order / 0010_verify / 0011_course
--   2. lessons（単元の規定時間）${lessonCount}件を投入
--
-- 何度実行しても壊れないように書いてある（作成済みなら飛ばす）。
-- 自動生成: npm run build:sql　— 直接編集しないこと
-- ═══════════════════════════════════════════════════════════

${read("supabase/migrations/0001_init.sql")}

${read("supabase/migrations/0002_rls.sql")}

${read("supabase/migrations/0003_rules.sql")}

${read("supabase/migrations/0004_auth.sql")}

${read("supabase/migrations/0005_cert.sql")}

${read("supabase/migrations/0006_version.sql")}

${read("supabase/migrations/0007_admin.sql")}

${read("supabase/migrations/0008_tenant.sql")}

${read("supabase/migrations/0009_order.sql")}

${read("supabase/migrations/0010_verify.sql")}

${read("supabase/migrations/0011_course.sql")}

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
