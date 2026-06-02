-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Create the posts table
create table posts (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  student_name text
);

-- Migration (run if table already exists):
-- alter table posts add column if not exists student_name text;

-- 2. Allow anyone to read and insert posts (no auth required)
alter table posts enable row level security;

create policy "Anyone can read posts"
  on posts for select
  using (true);

create policy "Anyone can insert posts"
  on posts for insert
  with check (true);

-- 3. Grant table access to API roles
grant select, insert on table posts to anon, authenticated;
