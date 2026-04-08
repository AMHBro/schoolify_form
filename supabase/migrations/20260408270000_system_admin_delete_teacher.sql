-- حذف معلّم من لوحة إدارة النظام (جلساته تُحذف تلقائيًا؛ teacher_id في الواجبات يصبح null)

create or replace function public.system_admin_delete_teacher (
  p_secret text,
  p_teacher_id uuid
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

  delete from public.teachers t
  where t.id = p_teacher_id;

  if not found then
    raise exception 'teacher_not_found';
  end if;
end;
$$;

grant execute on function public.system_admin_delete_teacher (text, uuid) to anon, authenticated;
