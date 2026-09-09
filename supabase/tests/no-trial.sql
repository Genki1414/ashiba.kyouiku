-- 0035 無償利用の抜け道が塞がっているか。
--
-- げんきさん（2026-09-09）「無償利用は撤廃する」。
--
-- 画面側で見なくしても、**データベースの抜け道は残る。**
-- 席の無い受講に修了証を挿し込めば、そのまま通ってしまっていた。
--
-- 流し方（新しいデータベースに）
--   00-supabase-shim.sql → apply-all.sql → このファイル
--   NOTICE で expected: が出れば通過。
select set_config('test.role','service_role', false);
do $$
declare co uuid := gen_random_uuid(); u uuid := gen_random_uuid(); en uuid;
begin
  insert into public.companies (id, name, trial) values (co, '無償利用だった会社', true);
  insert into auth.users (id) values (u);
  update public.users set company_id = co, name = '試用の人', email = 'trial@example.jp' where id = u;
  insert into public.enrollments (user_id, course_id) values (u, 'ashiba') returning id into en;
  begin
    insert into public.certificates (enrollment_id, cert_no) values (en, 'TEST-0035-001');
    raise exception '① 席が無いのに修了証が出てしまった';
  exception when others then
    if sqlerrm like '%受講コードがありません%' then
      raise notice 'expected: ① 席が無ければ、無償利用の会社でも修了証は出ない';
    else
      raise;
    end if;
  end;
  delete from public.enrollments where id = en;
  delete from public.users where id = u;
  delete from auth.users where id = u;
  delete from public.companies where id = co;
end $$;
