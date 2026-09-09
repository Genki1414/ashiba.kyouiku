select set_config('test.role','service_role', false);
do $$
declare u uuid := gen_random_uuid(); v uuid := gen_random_uuid();
        c1 text; c2 text; got uuid;
begin
  insert into auth.users (id) values (u),(v);
  update public.users set name='引き継ぐ人', email='h@example.jp' where id = u;

  -- ① 作れる（8文字・使ってよい字だけ）
  c1 := public.make_handoff(u);
  if length(c1) <> 8 or c1 ~ '[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]' then
    raise exception '① 形がおかしい（%）', c1;
  end if;
  raise notice 'expected: ① 8文字のコードを作れる';

  -- ② 作り直すと、前のは消える（同時に生きているのは1本）
  c2 := public.make_handoff(u);
  if (select count(*) from public.handoffs where user_id = u) <> 1 then
    raise exception '② 何本も生きている';
  end if;
  begin
    perform public.use_handoff(c1);
    raise exception '② 古いコードが通ってしまった';
  exception when others then
    if sqlerrm not like '%そのコードは使えません%' then raise; end if;
  end;
  raise notice 'expected: ② 作り直すと、前のコードは通らない';

  -- ③ 使えば、その人が返る
  got := public.use_handoff(c2);
  if got <> u then raise exception '③ 別の人が返った'; end if;
  raise notice 'expected: ③ 正しいコードで、その人が返る';

  -- ④ 2回目は通らない（1回きり）
  begin
    perform public.use_handoff(c2);
    raise exception '④ 二度使えてしまった';
  exception when others then
    if sqlerrm not like '%そのコードは使えません%' then raise; end if;
  end;
  raise notice 'expected: ④ 同じコードは二度使えない';

  -- ⑤ 切れたコードは通らない
  c1 := public.make_handoff(u);
  update public.handoffs set expires_at = now() - interval '1 minute' where code = c1;
  begin
    perform public.use_handoff(c1);
    raise exception '⑤ 切れたコードが通ってしまった';
  exception when others then
    if sqlerrm not like '%そのコードは使えません%' then raise; end if;
  end;
  raise notice 'expected: ⑤ 5分を過ぎたコードは通らない';

  -- ⑥ でたらめなコードは通らない
  begin
    perform public.use_handoff('ZZZZZZZZ');
    raise exception '⑥ でたらめが通ってしまった';
  exception when others then
    if sqlerrm not like '%そのコードは使えません%' then raise; end if;
  end;
  raise notice 'expected: ⑥ でたらめなコードは通らない';

  delete from public.handoffs where user_id in (u, v);
  delete from public.users where id in (u, v);
  delete from auth.users where id in (u, v);
end $$;
