-- ═══════════════════════════════════════════════════════════
-- 0026 修了証に、出したときの中身を焼き付ける
--
-- なぜ要るか
--   いままで certificates は「誰の受講か」と「番号」と「出した日」しか
--   持っていなかった。修了証の紙に載る講座名・科目・法定時間・根拠は、
--   見るたびに src/content/courses.ts の**そのときの値**から作っていた。
--
--   だから、法令が変わって講座を直した日に、
--   **前に出した修了証の中身まで変わってしまう。**
--   3年保存している記録が、あとから書き換わるということ。
--   これは記録として成り立たない。
--
-- 決めたこと
--   ・発行した瞬間の、講座名・根拠・法定時間・科目・法令バージョンを
--     certificates の行に書き込む（スナップショット）
--   ・照会も再表示も、**書き込んだ値を使う**。教材の側は見ない
--   ・0026 より前に出した修了証は、この欄が空。空のときだけ、
--     いまの教材の値で補って表示する（嘘をつかないよう、画面に断りを出す）
--
--   法令バージョンは src/content/courses.ts の LAW_VERSION（と講座ごとの
--   上書き）。法令が変わって講座を直したら、その講座の版を上げる。
-- ═══════════════════════════════════════════════════════════

alter table public.certificates
  -- どの講座か。courses.id と同じ文字。参照は張らない
  -- （講座を並べ替えたり消したりしても、出した紙は残る）
  add column if not exists course_id    text,
  -- 出したときの正式名称
  add column if not exists course_name  text,
  -- 出したときの法令の根拠
  add column if not exists basis        text,
  -- 出したときの法定時間（分）。学科（＋討議）
  add column if not exists total_min    integer,
  -- 出したときの科目と時間。[{ "id":1, "name":"…", "min":60 }, …]
  add column if not exists subjects     jsonb,
  -- 出したときの法令バージョン（courses.ts の LAW_VERSION）
  add column if not exists law_version  text;

comment on column public.certificates.course_name is
  '発行した時点の講座名。あとから教材を直しても書き換えない';
comment on column public.certificates.law_version is
  '発行した時点の法令バージョン。法令改正で講座を直しても、出した紙は変わらない';

-- 番号で照会するときに引く
create index if not exists certificates_course_idx on public.certificates (course_id);

-- ── 版 ─────────────────────────────────────
create or replace function public.schema_version()
returns text language sql stable set search_path = public as $$
  select '0026'
$$;

grant execute on function public.schema_version() to anon, authenticated, service_role;
