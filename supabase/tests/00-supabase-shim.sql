-- Supabase を立てずに素の PostgreSQL で検証するための代用品。
-- 本物の auth.users に近い形（既定値つき）にしてある。
create extension if not exists "pgcrypto";
create schema if not exists auth;
create table if not exists auth.users (
  id                 uuid primary key,
  instance_id        uuid,
  aud                varchar(255),
  role               varchar(255),
  email              varchar(255),
  encrypted_password varchar(255),
  created_at         timestamptz,
  updated_at         timestamptz,
  is_sso_user        boolean not null default false,
  is_anonymous       boolean not null default false,
  -- 登録のときに入れてもらった氏名がここに入る（0004_auth.sql が読む）
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
-- 先に作ってあった場合の後付け
alter table auth.users add column if not exists raw_user_meta_data jsonb not null default '{}'::jsonb;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role', true),''),'authenticated') $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
