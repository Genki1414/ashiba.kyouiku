-- 0034 LINE の紐付けが、店ごとに分かれているか。
--
-- げんきさんの報告（2026-09-09）
--   「足場屋革命でLINE登録したあとに、特別教育ドットコムでも
--     LINE登録したら重複してしまってる」
--
-- 流し方（新しいデータベースに、上から順に）
--   00-supabase-shim.sql → 0001 → 0002 → 0003 →（以降ぜんぶ）→ このファイル
--   NOTICE で expected: … が5つ出れば通過。
--
-- 確かめること
--   ① 同じ人が、店ごとに違う番号を持てる（これができないと重複する）
--   ② 同じ店の中では、1つの番号は1人にだけ
--   ③ 違う店なら、同じ番号でも入る（番号はプロバイダーごとなので、
--      たまたま同じ字になりうる）
--   ④ 1人につき、1店1行（二重に結べない）
--   ⑤ 人を消したら、紐付けも消える

-- 所属や権限を書き換える見張り（0003）は service_role だけ通す。
-- 種を仕込むあいだは、その立場で流す
select set_config('test.role', 'service_role', false);

do $$
declare
  co  uuid := gen_random_uuid();
  ua  uuid := gen_random_uuid();
  ub  uuid := gen_random_uuid();
  n   int;
begin
  insert into public.companies (id, name) values (co, 'LINE試験株式会社');
  -- auth.users に入れると public.users の行が自動でできる（0001 の仕掛け）。
  -- だから insert ではなく update で埋める
  insert into auth.users (id) values (ua), (ub);
  update public.users set company_id = co, name = 'げんき',    email = 'genki@example.jp' where id = ua;
  update public.users set company_id = co, name = 'よその人', email = 'other@example.jp' where id = ub;

  -- ① 同じ人が、店ごとに違う番号を持てる
  insert into public.line_links (user_id, brand, line_user_id)
    values (ua, 'ashibaya', 'U_ashibaya_genki'),
           (ua, 'tokubetsu', 'U_tokubetsu_genki');
  select count(*) into n from public.line_links where user_id = ua;
  if n <> 2 then
    raise exception '① 店ごとに持てない（%行）', n;
  end if;
  raise notice 'expected: ① 同じ人が、店ごとに違う番号を持てる（%行）', n;

  -- ② 同じ店の中では、1つの番号は1人にだけ
  begin
    insert into public.line_links (user_id, brand, line_user_id)
      values (ub, 'ashibaya', 'U_ashibaya_genki');
    raise exception '② よその人に同じ番号が付いてしまった';
  exception when unique_violation then
    raise notice 'expected: ② 同じ店では、1つの番号は1人にだけ';
  end;

  -- ③ 違う店なら、同じ字の番号でも入る
  insert into public.line_links (user_id, brand, line_user_id)
    values (ub, 'tokubetsu', 'U_ashibaya_genki');
  raise notice 'expected: ③ 店が違えば、同じ字の番号でも別物として入る';

  -- ④ 1人につき、1店1行
  begin
    insert into public.line_links (user_id, brand, line_user_id)
      values (ua, 'ashibaya', 'U_ashibaya_futatsume');
    raise exception '④ 同じ人・同じ店で2行入ってしまった';
  exception when unique_violation then
    raise notice 'expected: ④ 1人につき、1店1行';
  end;

  -- ⑤ 人を消したら、紐付けも消える
  delete from public.users where id = ub;
  select count(*) into n from public.line_links where user_id = ub;
  if n <> 0 then
    raise exception '⑤ 人を消しても紐付けが残った（%行）', n;
  end if;
  raise notice 'expected: ⑤ 人を消したら、紐付けも消える';

  -- 後片付け
  delete from public.users where id = ua;
  delete from public.companies where id = co;
  delete from auth.users where id in (ua, ub);
end $$;
