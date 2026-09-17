-- Run in Supabase SQL Editor. Access is through the backend only.
create table if not exists public.tikz_drawings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  source text not null check (char_length(source) between 1 and 20000),
  dpi integer not null default 180 check (dpi between 72 and 300),
  svg_url text not null,
  png_url text not null,
  cloudinary_public_id text not null,
  content_hash text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists tikz_drawings_created_at_idx on public.tikz_drawings (created_at desc, id desc);
alter table public.tikz_drawings enable row level security;
revoke all on public.tikz_drawings from anon, authenticated;
grant select, insert, update, delete on public.tikz_drawings to service_role;
