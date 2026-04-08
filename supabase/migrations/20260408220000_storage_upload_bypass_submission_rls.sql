-- رفع الملفات كان يُرفض: سياسة INSERT على storage.objects تستخدم EXISTS (...) على submissions
-- بدور anon، وجدول submissions عليه RLS بدون سياسة SELECT للعامة، فالاستعلام لا يرى أي صف.
-- الحل: التحقق من المسار عبر دالة SECURITY DEFINER (بصلاحية المالك) تتجاوز RLS على submissions.

create or replace function public.storage_can_upload_submission (object_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.submissions s
    where s.id::text = split_part(coalesce(object_path, ''), '/', 2)
      and s.assignment_id::text = split_part(coalesce(object_path, ''), '/', 1)
  );
$$;

drop policy if exists "submission_files_insert_matching_row" on storage.objects;

create policy "submission_files_insert_matching_row"
on storage.objects
for insert
to public
with check (
  bucket_id = 'submission-files'
  and public.storage_can_upload_submission(name)
);

grant execute on function public.storage_can_upload_submission (text) to anon, authenticated;

-- تأكيد عدم تقييد أنواع MIME على الـ bucket (ملفات متنوعة)
update storage.buckets
set allowed_mime_types = null
where id = 'submission-files';
