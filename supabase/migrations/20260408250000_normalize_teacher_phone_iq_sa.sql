-- تطبيع أرقام العراق (077… → 9647…) والسعودية (05… → 9665…) + توحيد مسافات الاسم

create or replace function public.normalize_teacher_phone (raw text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := nullif(regexp_replace(coalesce(trim(raw), ''), '\D', '', 'g'), '');
  if v is null then
    return null;
  end if;
  if v ~ '^964[0-9]{9,}$' then
    return v;
  end if;
  if v ~ '^966[0-9]{8,}$' then
    return v;
  end if;
  if v ~ '^07[0-9]{9}$' then
    return '964' || substr(v, 2);
  end if;
  if length(v) = 10 and v ~ '^7[0-9]{9}$' then
    return '964' || v;
  end if;
  if v ~ '^05[0-9]{8}$' then
    return '966' || substr(v, 2);
  end if;
  if length(v) = 9 and v ~ '^5[0-9]{8}$' then
    return '966' || v;
  end if;
  return v;
end;
$$;

/** تقليص مسافات الاسم للمقارنة والتخزين */
create or replace function public.normalize_teacher_full_name (raw text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g'));
$$;

update public.teachers
set
  phone_e164 = public.normalize_teacher_phone(phone_e164),
  full_name = public.normalize_teacher_full_name(full_name);

create or replace function public.teacher_register (p_full_name text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_teacher_phone(p_phone);
  v_name text := public.normalize_teacher_full_name(p_full_name);
  v_id uuid;
begin
  if length(coalesce(v_name, '')) < 2 then
    raise exception 'name_required';
  end if;
  if v_phone is null or length(v_phone) < 8 then
    raise exception 'phone_invalid';
  end if;

  insert into public.teachers (full_name, phone_e164)
  values (v_name, v_phone)
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
  v_name text := public.normalize_teacher_full_name(p_full_name);
  v_teacher public.teachers%rowtype;
  v_token uuid;
begin
  if v_phone is null or length(coalesce(v_name, '')) < 2 then
    raise exception 'invalid_credentials';
  end if;

  select * into v_teacher
  from public.teachers t
  where t.phone_e164 = v_phone
    and lower(public.normalize_teacher_full_name(t.full_name))
      = lower(v_name);

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
  v_name text := public.normalize_teacher_full_name(p_full_name);
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

  if length(coalesce(v_name, '')) < 2 then
    raise exception 'name_required';
  end if;
  if v_phone is null or length(v_phone) < 8 then
    raise exception 'phone_invalid';
  end if;

  insert into public.teachers (full_name, phone_e164)
  values (v_name, v_phone)
  returning id into v_id;

  return json_build_object('teacherId', v_id);
exception
  when unique_violation then
    raise exception 'phone_taken';
end;
$$;
