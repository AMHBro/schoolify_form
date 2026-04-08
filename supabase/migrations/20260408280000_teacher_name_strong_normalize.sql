-- توحيد أقوى للاسم (إزالة أحرف الاتجاه/عرض غير مرئية) + إعادة تطبيع الجوّال المخزّن + teacher_login أوضح

create or replace function public.normalize_teacher_full_name (raw text)
returns text
language plpgsql
immutable
as $$
declare
  s text := coalesce(raw, '');
  -- U+200B–U+200D, U+FEFF, U+200E/U+200F, U+202A–U+202E, U+2066–U+2069
  invisible constant text := '['
    || chr(8203) || chr(8204) || chr(8205) || chr(65279)
    || chr(8206) || chr(8207)
    || chr(8234) || chr(8235) || chr(8236) || chr(8237) || chr(8238)
    || chr(8294) || chr(8295) || chr(8296) || chr(8297)
    || ']';
begin
  s := regexp_replace(s, invisible, '', 'g');
  s := trim(
    regexp_replace(
      regexp_replace(s, E'[\t\n\r\f\v]+', ' ', 'g'),
      '\s+',
      ' ',
      'g'
    )
  );
  return s;
end;
$$;

update public.teachers
set
  full_name = public.normalize_teacher_full_name(full_name),
  phone_e164 = coalesce(
    public.normalize_teacher_phone(phone_e164),
    phone_e164
  );

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
    select * into v_teacher
    from public.teachers t
    where t.phone_e164 = v_phone
    order by t.created_at desc
    limit 1;
  end if;

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
