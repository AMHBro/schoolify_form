-- إن لم يطابق الاسم بعد التطبيع، لكن رقم الجوال يطابق سجلًا واحدًا فقط، يُسمح بالدخول
-- (يقلّل فشل الدخول بسبب اختلاف بسيط في كتابة الاسم العربي)

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
