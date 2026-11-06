-- Chạy trong Supabase SQL Editor để kích hoạt lưu trữ kỳ thi chấm trắc nghiệm.
-- Bảng lưu danh sách kỳ thi, cấu hình số câu, đáp án các mã đề và bài đã chấm.

create table if not exists public.grade_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  sheet_type text not null default '2025_math',
  config jsonb not null default '{"maxP1": 12, "maxP2": 4, "maxP3": 6}'::jsonb,
  answer_keys jsonb not null default '{}'::jsonb,
  submissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grade_exams_updated_idx on public.grade_exams (updated_at desc, id desc);

alter table public.grade_exams enable row level security;
revoke all on public.grade_exams from anon, authenticated;
grant select, insert, update, delete on public.grade_exams to service_role;

