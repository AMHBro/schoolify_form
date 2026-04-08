-- لوحة إدارة النظام: مفتاح سري + RPCs (إضافة معلّم، قائمة معلّمين، قائمة واجبات، حذف واجب)
-- بعد الترحيل: نفّذ في SQL Editor — UPDATE public.system_admin_config SET secret_key = 'مفتاح-طويل-سري';

create table if not exists public.system_admin_config (
  id smallint primary key default 1 check (id = 1),
  secret_key text not null
);

insert into public.system_admin_config (id, secret_key)
values (1, 'change-me-in-supabase-sql-editor')
on conflict (id) do nothing;

alter table public.system_admin_config enable row level security;

-- ----------------- system_admin_list_teachers -----------------

create or replace function public.system_admin_list_teachers (p_secret text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1
    from public.system_admin_config c
    where c.id = 1
      and trim(c.secret_key) = trim(coalesce(p_secret, ''))
  ) then
    raise exception 'system_admin_forbidden';
  end if;

  return coalesce(
    (
      select json_agg(
        json_build_object(
          'id', t.id,
          'fullName', t.full_name,
          'phone', t.phone_e164,
          'createdAt', t.created_at
        )
        order by t.created_at desc
      )
      from public.teachers t
    ),
    '[]'::json
  );
end;
$$;

-- ----------------- system_admin_register_teacher -----------------

create or replace function public.system_admin_register_teacher (
  p_secret text,
  p_full_name text,
  p_phone text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_teacher_phone(p_phone);
  v_id uuid;
begin
  if not exists (
    select 1
    from public.system_admin_config c
    where c.id = 1
      and trim(c.secret_key) = trim(coalesce(p_secret, ''))
  ) then
    raise exception 'system_admin_forbidden';
  end if;

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

-- ----------------- system_admin_list_assignments -----------------

create or replace function public.system_admin_list_assignments (p_secret text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1
    from public.system_admin_config c
    where c.id = 1
      and trim(c.secret_key) = trim(coalesce(p_secret, ''))
  ) then
    raise exception 'system_admin_forbidden';
  end if;

  return coalesce(
    (
      select json_agg(j order by row_sort desc)
      from (
        select
          json_build_object(
            'id', a.id,
            'title', a.title,
            'shareCode', a.share_code,
            'createdAt', a.created_at,
            'deadlineAt', a.deadline_at,
            'teacherName', t.full_name,
            'submissionCount',
            (
              select count(*)::int
              from public.submissions s
              where s.assignment_id = a.id
            )
          ) as j,
          a.created_at as row_sort
        from public.assignments a
        left join public.teachers t on t.id = a.teacher_id
      ) sub
    ),
    '[]'::json
  );
end;
$$;

-- ----------------- system_admin_delete_assignment -----------------

create or replace function public.system_admin_delete_assignment (
  p_secret text,
  p_assignment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.system_admin_config c
    where c.id = 1
      and trim(c.secret_key) = trim(coalesce(p_secret, ''))
  ) then
    raise exception 'system_admin_forbidden';
  end if;

  delete from public.assignments a where a.id = p_assignment_id;
  if not found then
    raise exception 'assignment_not_found';
  end if;
end;
$$;

grant execute on function public.system_admin_list_teachers (text) to anon, authenticated;
grant execute on function public.system_admin_register_teacher (text, text, text) to anon, authenticated;
grant execute on function public.system_admin_list_assignments (text) to anon, authenticated;
grant execute on function public.system_admin_delete_assignment (text, uuid) to anon, authenticated;
