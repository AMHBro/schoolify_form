-- مطابقة كود المشاركة بدون حساسية لحالة الأحرف + تجاهل فراغات

create or replace function public.get_assignment_by_share_code (p_code text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select (to_jsonb(a) - 'teacher_view_token')::json
  from public.assignments a
  where upper(trim(a.share_code)) = upper(trim(p_code))
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
  where upper(trim(share_code)) = upper(trim(p_share_code));

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
      and upper(trim(a.share_code)) = upper(trim(p_share_code))
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
