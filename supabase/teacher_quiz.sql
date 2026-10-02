-- Run in Supabase SQL Editor. Browser clients have no direct table access.
create table if not exists public.teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  created_at timestamptz not null default now()
);
create table if not exists public.teacher_exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  answers text[] not null check (cardinality(answers) between 1 and 120),
  created_at timestamptz not null default now()
);
create table if not exists public.teacher_results (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(user_id) on delete cascade,
  exam_id uuid not null references public.teacher_exams(id) on delete cascade,
  answers text[] not null,
  score integer not null,
  total integer not null,
  uncertain_questions integer[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists teacher_exams_owner_idx on public.teacher_exams(teacher_id, created_at desc);
create index if not exists teacher_results_owner_idx on public.teacher_results(teacher_id, created_at desc);
alter table public.teacher_profiles enable row level security;
alter table public.teacher_exams enable row level security;
alter table public.teacher_results enable row level security;
revoke all on public.teacher_profiles, public.teacher_exams, public.teacher_results from anon, authenticated;
grant select, insert, update, delete on public.teacher_profiles, public.teacher_exams, public.teacher_results to service_role;
