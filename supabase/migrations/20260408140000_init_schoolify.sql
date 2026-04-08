-- Schoolify: assignments + submissions + assets (PostgreSQL / Supabase)
-- نفّذ هذا الملف من لوحة Supabase > SQL Editor أو عبر Supabase CLI

create extension if not exists "pgcrypto";

-- جداول ---------------------------------------------------------------

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  deadline_at timestamptz,
  share_code text not null unique,
  fields jsonb not null default '[]'::jsonb,
  teacher_view_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists submissions_assignment_id_idx
  on public.submissions (assignment_id);

create table if not exists public.submission_assets (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  field_id text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  is_image boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists submission_assets_submission_id_idx
  on public.submission_assets (submission_id);

-- RLS: منع القراءة/الكتابة المباشرة؛ الوصول عبر دوال SECURITY DEFINER ----

alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_assets enable row level security;

-- دوال للطلاب والأستاذ --------------------------------------------------

create or replace function public.get_assignment_by_share_code (p_code text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select (to_jsonb(a) - 'teacher_view_token')::json
  from public.assignments a
  where a.share_code = p_code
  limit 1;
$$;

create or replace function public.create_submission (
  p_share_code text,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.assignments%rowtype;
  v_id uuid;
begin
  select * into v_row
  from public.assignments
  where share_code = p_share_code;

  if not found then
    raise exception 'not_found';
  end if;

  if v_row.deadline_at is not null and v_row.deadline_at < now() then
    raise exception 'deadline_passed';
  end if;

  insert into public.submissions (assignment_id, answers)
  values (v_row.id, coalesce(p_answers, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.register_submission_asset (
  p_share_code text,
  p_submission_id uuid,
  p_field_id text,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_is_image boolean,
  p_sort_order int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = p_submission_id
      and a.share_code = p_share_code
  ) then
    raise exception 'invalid_submission';
  end if;

  insert into public.submission_assets (
    submission_id,
    field_id,
    storage_path,
    original_name,
    mime_type,
    is_image,
    sort_order
  )
  values (
    p_submission_id,
    p_field_id,
    p_storage_path,
    p_original_name,
    p_mime_type,
    coalesce(p_is_image, false),
    coalesce(p_sort_order, 0)
  );
end;
$$;

create or replace function public.get_teacher_dashboard_data (
  p_assignment_id uuid,
  p_teacher_token uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assign jsonb;
  v_subs json;
begin
  select to_jsonb(a) - 'teacher_view_token'
  into v_assign
  from public.assignments a
  where a.id = p_assignment_id
    and a.teacher_view_token = p_teacher_token;

  if v_assign is null then
    raise exception 'forbidden';
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'id', s.id,
        'studentName', coalesce(s.answers->>'student_name', s.answers->>'name', 'طالب'),
        'submittedAt', s.created_at,
        'textAnswer', nullif(trim(both from coalesce(s.answers->>'answer_text', '')), ''),
        'assets', coalesce((
          select json_agg(
            json_build_object(
              'name', sa.original_name,
              'path', sa.storage_path,
              'isImage', sa.is_image
            )
            order by sa.sort_order, sa.created_at
          )
          from public.submission_assets sa
          where sa.submission_id = s.id
        ), '[]'::json)
      )
      order by s.created_at desc
    ),
    '[]'::json
  )
  into v_subs
  from public.submissions s
  where s.assignment_id = p_assignment_id;

  return json_build_object(
    'assignment', v_assign,
    'submissions', v_subs
  );
end;
$$;

grant execute on function public.get_assignment_by_share_code (text) to anon, authenticated;
grant execute on function public.create_submission (text, jsonb) to anon, authenticated;
grant execute on function public.register_submission_asset (
  text, uuid, text, text, text, text, boolean, int
) to anon, authenticated;
grant execute on function public.get_teacher_dashboard_data (uuid, uuid) to anon, authenticated;

-- تخزين الملفات ---------------------------------------------------------

drop policy if exists "submission_files_select_public" on storage.objects;
drop policy if exists "submission_files_insert_matching_row" on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-files',
  'submission-files',
  true,
  10485760,
  array[
    'image/jpeg'::text,
    'image/png'::text,
    'image/webp'::text,
    'application/pdf'::text
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "submission_files_select_public"
on storage.objects
for select
to public
using (bucket_id = 'submission-files');

create policy "submission_files_insert_matching_row"
on storage.objects
for insert
to public
with check (
  bucket_id = 'submission-files'
  and exists (
    select 1
    from public.submissions s
    where s.id::text = split_part(name, '/', 2)
      and s.assignment_id::text = split_part(name, '/', 1)
  )
);
