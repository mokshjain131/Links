-- Links Database Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Create posts table (without foreign key to auth.users for simpler dev setup)
create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  url          text not null,
  platform     text,
  title        text,
  summary      text,
  category     text,
  subcategory  text,
  tags         text[] default '{}',
  sentiment    text,
  content_type text,
  thumbnail_url text,
  author       text,
  saved_at     timestamptz default now()
);

-- Index for common queries
create index if not exists idx_posts_user_id on posts(user_id);
create index if not exists idx_posts_category on posts(user_id, category);
create index if not exists idx_posts_saved_at on posts(user_id, saved_at desc);

-- Unique constraint for duplicate detection
create unique index if not exists idx_posts_user_url on posts(user_id, url);

-- Disable RLS for development (enable in production with proper policies)
alter table posts disable row level security;
