/* supabase/apply-all.sql を組み立てる。
   マイグレーション3本＋lessons の投入＋開発用 seed を1ファイルにまとめ、
   Supabase の SQL Editor に一度貼るだけで初期化が終わるようにする。
   実行: npm run build:sql */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CurriculumSchema } from "../src/types/curriculum";

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf-8");
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

const cur = CurriculumSchema.parse(JSON.parse(read("content/curriculum.json")));
const lessonRows = cur.subjects
  .flatMap((s, si) =>
    s.lessons.map(
      (l, li) =>
        `  (${q(l.id)}, ${s.id}, ${q(l.title)}, ${l.legal_min}, ${si * 100 + li})`,
    ),
  )
  .join(",\n");

const out = `-- ═══════════════════════════════════════════════════════════
-- 足場トレーニング Supabase 初期化（このファイルを SQL Editor に貼って実行）
--
-- 中身:
--   1. マイグレーション 0001_init / 0002_rls / 0003_rules / 0004_auth / 0005_cert / 0006_version / 0007_admin / 0008_tenant / 0009_order
--   2. lessons（単元の規定時間）${cur.subjects.reduce((n, s) => n + s.lessons.length, 0)}件を投入
--   3. 開発用の事業者・受講者・受講コード・受講（フェーズ1〜2で使う）
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

-- ═══════════════════════════════════════════════════════════
-- 4. lessons（curriculum.json の単元ID・題名・規定時間の写し）
-- ═══════════════════════════════════════════════════════════
insert into public.lessons (lesson_id, subject_id, title, legal_min, sort_order) values
${lessonRows}
on conflict (lesson_id) do update
  set subject_id = excluded.subject_id,
      title      = excluded.title,
      legal_min  = excluded.legal_min,
      sort_order = excluded.sort_order;

${read("supabase/seed.sql")}
-- ═══════════════════════════════════════════════════════════
-- 完了。最後に出る enrollment_id を .env.local の DEV_ENROLLMENT_ID に入れる
-- （既定値のままでよい: 55555555-5555-5555-5555-555555555555）
-- ═══════════════════════════════════════════════════════════
select
  (select count(*) from public.lessons)                     as lessons,
  (select count(*) from public.enrollments)                 as enrollments,
  '55555555-5555-5555-5555-555555555555'::uuid              as dev_enrollment_id;
`;

writeFileSync(path.join(root, "supabase/apply-all.sql"), out);
console.log("OK  supabase/apply-all.sql を生成");
