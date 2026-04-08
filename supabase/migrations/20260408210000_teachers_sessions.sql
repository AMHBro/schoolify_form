-- معلمون + جلسات + ربط الواجبات بمعلّم؛ دعم تسجيل الدخول بالاسم ورقم الجوال

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone_e164 text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_sessions (
  token uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_sessions_teacher_id_idx
  on public.teacher_sessions (teacher_id);

alter table public.assignments
  add column if not exists teacher_id uuid references public.teachers (id) on delete set null;

-- تطبيع رقم الجوال: أرقام فقط (بدون مسافات وشرطات)
create or replace function public.normalize_teacher_phone (raw text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(coalesce(trim(raw), ''), '\D', '', 'g'),
    ''
  )::text;
$$;

create or replace function public.resolve_teacher_session (p_token uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select s.teacher_id
  from public.teacher_sessions s
  where s.token = p_token
    and s.expires_at > now()
  limit 1;
$$;

create or replace function public.teacher_register (p_full_name text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_teacher_phone(p_phone);
  v_id uuid;
begin
  if length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'name_required';
  end if;
  if v_phone is null or length(v_phone) < 8 then
    raise exception 'phone_invalid';
  end if;

  insert into public.teachers (full_name, phone_e164)
  values (trim(p_full_name), v_phone)
  returning id into v_id;

  return json_build_object('teacherId', v_id);
exception
  when unique_violation then
    raise exception 'phone_taken';
end;
$$;

create or replace function public.teacher_login (p_full_name text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_teacher_phone(p_phone);
  v_teacher public.teachers%rowtype;
  v_token uuid;
begin
  if v_phone is null or length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'invalid_credentials';
  end if;

  select * into v_teacher
  from public.teachers t
  where t.phone_e164 = v_phone
    and lower(trim(t.full_name)) = lower(trim(p_full_name));

  if not found then
    raise exception 'invalid_credentials';
  end if;

  insert into public.teacher_sessions (teacher_id, expires_at)
  values (v_teacher.id, now() + interval '30 days')
  returning token into v_token;

  return json_build_object(
    'token', v_token,
    'teacherId', v_teacher.id,
    'fullName', v_teacher.full_name
  );
end;
$$;

create or replace function public.list_teacher_assignments (p_session_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid uuid := public.resolve_teacher_session(p_session_token);
begin
  if v_tid is null then
    raise exception 'session_invalid';
  end if;

  return coalesce(
    (
      select json_agg(
        json_build_object(
          'id', a.id,
          'title', a.title,
          'shareCode', a.share_code,
          'deadlineAt', a.deadline_at,
          'createdAt', a.created_at,
          'submissionCount', (
            select count(*)::int
            from public.submissions s
            where s.assignment_id = a.id
          )
        )
        order by a.created_at desc nulls last
      )
      from public.assignments a
      where a.teacher_id = v_tid
    ),
    '[]'::json
  );
end;
$$;

create or replace function public.get_teacher_dashboard_for_session (
  p_session_token uuid,
  p_assignment_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid uuid := public.resolve_teacher_session(p_session_token);
  v_assign jsonb;
  v_subs json;
begin
  if v_tid is null then
    raise exception 'session_invalid';
  end if;

  select to_jsonb(a) - 'teacher_view_token'
  into v_assign
  from public.assignments a
  where a.id = p_assignment_id
    and a.teacher_id = v_tid;

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

create or replace function public.create_assignment_session (
  p_session_token uuid,
  p_title text,
  p_description text,
  p_deadline_at timestamptz,
  p_fields jsonb,
  p_share_code text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid uuid := public.resolve_teacher_session(p_session_token);
  v_code text;
  v_try int := 0;
  v_id uuid;
  v_token uuid;
begin
  if v_tid is null then
    raise exception 'session_invalid';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title_required';
  end if;

  if p_fields is null
    or jsonb_typeof(p_fields) <> 'array'
    or jsonb_array_length(p_fields) = 0
  then
    raise exception 'fields_required';
  end if;

  v_code := nullif(upper(trim(p_share_code)), '');

  if v_code is not null then
    if length(v_code) < 4 or length(v_code) > 40 then
      raise exception 'share_code_length';
    end if;
    if v_code !~ '^[A-Z0-9_-]+$' then
      raise exception 'share_code_format';
    end if;
    if exists (
      select 1
      from public.assignments
      where upper(trim(share_code)) = v_code
    ) then
      raise exception 'share_code_taken';
    end if;
  else
    loop
      v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
      exit when not exists (
        select 1
        from public.assignments
        where upper(trim(share_code)) = v_code
      );
      v_try := v_try + 1;
      if v_try > 80 then
        raise exception 'code_gen_failed';
      end if;
    end loop;
  end if;

  insert into public.assignments (
    title,
    description,
    deadline_at,
    share_code,
    fields,
    teacher_id
  )
  values (
    trim(p_title),
    nullif(trim(p_description), ''),
    p_deadline_at,
    v_code,
    coalesce(p_fields, '[]'::jsonb),
    v_tid
  )
  returning id, teacher_view_token into v_id, v_token;

  return json_build_object(
    'id', v_id,
    'shareCode', v_code,
    'teacherViewToken', v_token
  );
end;
$$;

-- تخزين: السماح بأنواع ملفات أوسع (كان pdf/png/jpeg/webp فقط فيسب فشل رفع)
update storage.buckets
set allowed_mime_types = null
where id = 'submission-files';

grant execute on function public.normalize_teacher_phone (text) to anon, authenticated;
grant execute on function public.teacher_register (text, text) to anon, authenticated;
grant execute on function public.teacher_login (text, text) to anon, authenticated;
grant execute on function public.list_teacher_assignments (uuid) to anon, authenticated;
grant execute on function public.get_teacher_dashboard_for_session (uuid, uuid) to anon, authenticated;
grant execute on function public.create_assignment_session (
  uuid, text, text, timestamptz, jsonb, text
) to anon, authenticated;
