\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
insert into companies (id,name) values ('22222222-2222-2222-2222-222222222222','テスト工業');
insert into users (id,company_id,name) values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','受講太郎');
insert into orders (id,company_id,seats,unit_price,amount,method,status)
  values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',1,12000,12000,'invoice','pending');
insert into seats (id,order_id,code,used_by,used_at)
  values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','ABC-123','11111111-1111-1111-1111-111111111111',now());
insert into enrollments (id,user_id,seat_id) values ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
insert into lessons values ('1-1',1,'足場の種類、材料、構造及び組立図',50,1);

set test.uid = '11111111-1111-1111-1111-111111111111';

\echo -- 1) 申告1000秒でも実経過で頭打ち
select sync_watched_sec('55555555-5555-5555-5555-555555555555','1-1',1000) as watched;

\echo -- 2) 規定時間未満なら合格にできない
do $$ begin
  perform mark_quiz_passed('55555555-5555-5555-5555-555555555555','1-1');
  raise exception 'ここへ来てはいけない';
exception when others then raise notice 'expected: %', sqlerrm; end $$;

\echo -- 3) 規定時間到達後は合格する
update progress set watched_sec = 3000 where enrollment_id='55555555-5555-5555-5555-555555555555';
select mark_quiz_passed('55555555-5555-5555-5555-555555555555','1-1') is not null as passed;

\echo -- 4) 未入金では修了証を発行できない
do $$ begin
  insert into certificates (enrollment_id,cert_no) values ('55555555-5555-5555-5555-555555555555','2026-0001');
  raise exception 'ここへ来てはいけない';
exception when others then raise notice 'expected: %', sqlerrm; end $$;

\echo -- 5) 入金後は発行できる
update orders set status='paid', paid_at=now() where id='33333333-3333-3333-3333-333333333333';
insert into certificates (enrollment_id,cert_no) values ('55555555-5555-5555-5555-555555555555','2026-0001');
select count(*) as certs from certificates;

\echo -- 6) 他人の受講は加算できない
set test.uid = '99999999-9999-9999-9999-999999999999';
do $$ begin
  perform sync_watched_sec('55555555-5555-5555-5555-555555555555','1-1',10);
  raise exception 'ここへ来てはいけない';
exception when others then raise notice 'expected: %', sqlerrm; end $$;

\echo -- 7) 所属・権限の書き換えは止まる
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  update users set role='admin' where id='11111111-1111-1111-1111-111111111111';
  raise exception 'ここへ来てはいけない';
exception when others then raise notice 'expected: %', sqlerrm; end $$;

\echo -- 8) status/paid_at の不整合は入らない
do $$ begin
  update orders set status='pending' where id='33333333-3333-3333-3333-333333333333';
  raise exception 'ここへ来てはいけない';
exception when others then raise notice 'expected: %', sqlerrm; end $$;
