-- منع تسجيل المعلّم الذاتي: الإضافة فقط عبر system_admin_register_teacher (لوحة /system)
-- تسجيل الدخول teacher_login يبقى للصفوف الموجودة في public.teachers فقط

create or replace function public.teacher_register (p_full_name text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'registration_admin_only';
end;
$$;
