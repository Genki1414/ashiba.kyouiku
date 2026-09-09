-- 受講コードを指して配る（0031）を、素の PostgreSQL に当てて確かめる。
--
-- 手順は supabase/tests/README.md と同じ。シムと apply-all.sql を流したあと：
--   psql -d appdb -q -t -A -f supabase/tests/assign-by-code.sql
--
-- 0028 の assign_seat は、空いている席から自動で1枚選んでいた。
-- 受講コードの一覧の「配る」からは、**押したそのコード**が渡らないとおかしい
-- （げんきさん 2026-09-09）。
--
-- ここで見るのは、SQL でしか確かめられないこと。
--   ・コードを指したら、その1枚が渡るか（自動で別の1枚を選ばないか）
--   ・指さなければ、今までどおり自動で選ぶか（名簿の「席を配る」が壊れない）
--   ・使用済み・別の講座・よその会社のコードを指しても渡らないか
--   ・断るときの文が、**よその会社のコードの在り処を教えないか**
--   ・修了証が出ている（取得済み）人には渡らないか。席を戻したあとでも
-- 画面側の決まりは npx tsx tests/api-shape.mts が見ている。

\set ON_ERROR_STOP on
\pset pager off
set test.role = 'service_role';

-- 会社2つ、人3人（1人はよその会社）
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000031','p1@x.jp'),
  ('a0000000-0000-0000-0000-000000000032','p2@x.jp'),
  ('a0000000-0000-0000-0000-000000000033','yoso@x.jp'),
  ('a0000000-0000-0000-0000-000000000034','done@x.jp')
on conflict (id) do nothing;
insert into public.companies (id, name) values
  ('c0000000-0000-0000-0000-000000000031','指して配る工業'),
  ('c0000000-0000-0000-0000-000000000032','よその建設')
on conflict (id) do nothing;
insert into public.users (id, email, name, company_id) values
  ('a0000000-0000-0000-0000-000000000031','p1@x.jp','一人目','c0000000-0000-0000-0000-000000000031'),
  ('a0000000-0000-0000-0000-000000000032','p2@x.jp','二人目','c0000000-0000-0000-0000-000000000031'),
  ('a0000000-0000-0000-0000-000000000033','yoso@x.jp','よその人','c0000000-0000-0000-0000-000000000032'),
  ('a0000000-0000-0000-0000-000000000034','done@x.jp','取得済みの人','c0000000-0000-0000-0000-000000000031')
on conflict (id) do update set company_id = excluded.company_id;
insert into public.memberships (user_id, company_id, requested_at, approved_at) values
  ('a0000000-0000-0000-0000-000000000031','c0000000-0000-0000-0000-000000000031', now(), now()),
  ('a0000000-0000-0000-0000-000000000032','c0000000-0000-0000-0000-000000000031', now(), now()),
  ('a0000000-0000-0000-0000-000000000033','c0000000-0000-0000-0000-000000000032', now(), now()),
  ('a0000000-0000-0000-0000-000000000034','c0000000-0000-0000-0000-000000000031', now(), now())
on conflict do nothing;

do $$
declare
  co    uuid := 'c0000000-0000-0000-0000-000000000031';
  yoso  uuid := 'c0000000-0000-0000-0000-000000000032';
  p1    uuid := 'a0000000-0000-0000-0000-000000000031';
  p2    uuid := 'a0000000-0000-0000-0000-000000000032';
  p3    uuid := 'a0000000-0000-0000-0000-000000000034';
  adm   uuid := 'a0000000-0000-0000-0000-000000000031';
  o1    uuid; o2 uuid; o3 uuid; e3 uuid;
  got   text;
  n     int;
  msg   text;
begin
  -- 自社：足場3枚（AAAA / BBBB / CCCC）、石綿1枚（DDDD）。よそ：足場1枚（EEEE）
  insert into orders (company_id, course_id, seats, unit_price, amount, method, status, paid_at, ordered_by)
  values (co, 'ashiba', 3, 4500, 14850, 'invoice', 'paid', now(), adm) returning id into o1;
  insert into seats (order_id, code) values (o1, 'AAAA-2222-3333'), (o1, 'BBBB-2222-3333'), (o1, 'CCCC-2222-3333');
  insert into orders (company_id, course_id, seats, unit_price, amount, method, status, paid_at, ordered_by)
  values (co, 'ishiwata', 1, 4500, 4950, 'invoice', 'paid', now(), adm) returning id into o2;
  insert into seats (order_id, code) values (o2, 'DDDD-2222-3333');
  insert into orders (company_id, course_id, seats, unit_price, amount, method, status, paid_at, ordered_by)
  values (yoso, 'ashiba', 1, 4500, 4950, 'invoice', 'paid', now(), 'a0000000-0000-0000-0000-000000000033') returning id into o3;
  insert into seats (order_id, code) values (o3, 'EEEE-2222-3333');

  -- ※ 席を配る前に、断る側を先に見る。配ったあとだと「もう渡っている」の
  --    見張りが先に鳴って、コードの見張りまで届かない
  -- ④ **よその会社のコードを指しても渡らない。**しかも文で在り処を教えない
  --    （「別の講座です」と返すと、そのコードが在ることを教えてしまう）
  begin
    perform public.assign_seat(co, p1, 'ashiba', adm, 'EEEE-2222-3333');
    raise exception 'NG: よその会社のコードが渡ってしまった';
  exception when others then
    msg := sqlerrm;
    raise notice 'expected: よその会社のコードは配れない（%）', msg;
    if msg not like '%配れません%' then raise exception 'NG: 断る文が違う（%）', msg; end if;
    if msg like '%よそ%' or msg like '%別の会社%' then
      raise exception 'NG: よその会社のコードだと教えてしまっている（%）', msg;
    end if;
  end;
  select count(*) into n from seats where code = 'EEEE-2222-3333' and used_by is not null;
  if n <> 0 then raise exception 'NG: よその席が使われた'; end if;

  -- ③ 別の講座のコードを指しても渡らない（足場の CCCC を、石綿として）
  begin
    perform public.assign_seat(co, p1, 'ishiwata', adm, 'CCCC-2222-3333');
    raise exception 'NG: 別の講座のコードを指して渡ってしまった';
  exception when others then
    msg := sqlerrm;
    raise notice 'expected: 別の講座のコードは配れない（%）', msg;
    if msg not like '%配れません%' then raise exception 'NG: 断る文が違う（%）', msg; end if;
  end;

  -- ① **指したコードが、そのまま渡る。**自動なら AAAA が先に選ばれるはずの所で CCCC を指す
  got := public.assign_seat(co, p1, 'ashiba', adm, 'CCCC-2222-3333');
  raise notice 'expected: 指した CCCC が渡る（%）', got;
  if got <> 'CCCC-2222-3333' then raise exception 'NG: 指したのと違うコードが渡った（%）', got; end if;
  select count(*) into n from seats where code = 'CCCC-2222-3333' and used_by = p1;
  if n <> 1 then raise exception 'NG: CCCC が p1 のものになっていない'; end if;

  -- ② 指さなければ、今までどおり自動（古い順・コード順）。名簿の「席を配る」の道
  got := public.assign_seat(co, p2, 'ashiba', adm);
  raise notice 'expected: 指さなければ自動で AAAA（%）', got;
  if got <> 'AAAA-2222-3333' then raise exception 'NG: 自動の選び方が変わった（%）', got; end if;

  -- ⑤ 期限切れのコードを指しても渡らない
  update seats set expires_at = now() - interval '1 day' where code = 'BBBB-2222-3333';
  begin
    -- p1 は足場を持っているので、二重渡しで止まる前に期限を見せるため、石綿の席を期限切れにして見る
    update seats set expires_at = now() - interval '1 day' where code = 'DDDD-2222-3333';
    perform public.assign_seat(co, p2, 'ishiwata', adm, 'DDDD-2222-3333');
    raise exception 'NG: 期限切れのコードが渡ってしまった';
  exception when others then
    msg := sqlerrm;
    raise notice 'expected: 期限切れのコードは配れない（%）', msg;
    if msg not like '%配れません%' then raise exception 'NG: 断る文が違う（%）', msg; end if;
  end;

  -- ⑥ 指して配ったら、その人のその講座の受講リクエストは片づく（0028 と同じ）
  insert into course_requests (user_id, company_id, course_id) values (p2, co, 'ishiwata');
  update seats set expires_at = null where code = 'DDDD-2222-3333';
  got := public.assign_seat(co, p2, 'ishiwata', adm, 'DDDD-2222-3333');
  select count(*) into n from course_requests where user_id = p2 and course_id = 'ishiwata' and handled_at is null;
  raise notice 'expected: 配ったら受講リクエストは片づく（残り %）', n;
  if n <> 0 then raise exception 'NG: 受講リクエストが残っている'; end if;

  -- ⑦ **取得済み（修了証が出ている）人には渡らない。**
  --    席を戻したあと（seat_id が空）でも止まること。
  --    「もう渡っている」の見張りは seat_id を見るので、そこだけでは通ってしまう
  insert into seats (order_id, code) values (o1, 'FFFF-2222-3333'), (o1, 'GGGG-2222-3333');
  got := public.assign_seat(co, p3, 'ashiba', adm, 'FFFF-2222-3333');
  select id into e3 from enrollments where user_id = p3 and course_id = 'ashiba' and seat_id is not null;
  insert into certificates (enrollment_id, cert_no, issued_by) values (e3, 'T-0031-0001', adm);
  -- 席を戻す（取り消し）。seat_id が空に戻り、「もう渡っている」では止まらなくなる
  perform public.release_seat((select id from seats where code = 'FFFF-2222-3333'));
  begin
    perform public.assign_seat(co, p3, 'ashiba', adm, 'GGGG-2222-3333');
    raise exception 'NG: 取得済みの人に渡ってしまった';
  exception when others then
    msg := sqlerrm;
    raise notice 'expected: 取得済みの人には配れない（%）', msg;
    if msg not like '%取得済み%' then raise exception 'NG: 断る文が違う（%）', msg; end if;
  end;
  select count(*) into n from seats where code = 'GGGG-2222-3333' and used_by is not null;
  if n <> 0 then raise exception 'NG: 取得済みの人に席が使われた'; end if;
  -- 取り消した修了証なら渡る（受け直しの道は残す）
  update certificates set revoked_at = now() where enrollment_id = e3;
  got := public.assign_seat(co, p3, 'ashiba', adm, 'GGGG-2222-3333');
  raise notice 'expected: 取り消したあとなら渡る（%）', got;
  if got <> 'GGGG-2222-3333' then raise exception 'NG: 取り消したのに渡らない（%）', got; end if;
end $$;

select 'OK: 受講コードを指して配る（0031）';
