-- إنشاء واجب جديد من واجهة الأستاذ (يعيد معرفات المشاركة ورمز مراجعة اللوحة)

create or replace function public.create_assignment (
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
  v_code text;
  v_try int := 0;
  v_id uuid;
  v_token uuid;
begin
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
    if exists (select 1 from public.assignments where share_code = v_code) then
      raise exception 'share_code_taken';
    end if;
  else
    loop
      v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
      exit when not exists (select 1 from public.assignments where share_code = v_code);
      v_try := v_try + 1;
      if v_try > 80 then
        raise exception 'code_gen_failed';
      end if;
    end loop;
  end if;

  insert into public.assignments (title, description, deadline_at, share_code, fields)
  values (
    trim(p_title),
    nullif(trim(p_description), ''),
    p_deadline_at,
    v_code,
    coalesce(p_fields, '[]'::jsonb)
  )
  returning id, teacher_view_token into v_id, v_token;

  return json_build_object(
    'id', v_id,
    'shareCode', v_code,
    'teacherViewToken', v_token
  );
end;
$$;

grant execute on function public.create_assignment (text, text, timestamptz, jsonb, text) to anon, authenticated;
