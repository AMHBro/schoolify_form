-- بذرة تجريبية — بعد الهجرات

insert into public.assignments (
  id,
  title,
  description,
  deadline_at,
  share_code,
  fields,
  teacher_view_token
)
values (
  'a0e8400e-d29f-41d4-a716-446655440000'::uuid,
  'واجب تجريبي',
  null,
  now() + interval '7 days',
  'DEMO2024',
  '[
    {"id":"student_name","type":"text","label":"اسم الطالب","required":true},
    {"id":"answer_text","type":"text","label":"ملاحظات على الحل (اختياري)","required":false},
    {"id":"solution_images","type":"images","label":"صور الحل","required":true,"accept":"image/jpeg,image/png,image/webp","maxFiles":10},
    {"id":"extra_pdf","type":"files","label":"ملف PDF إضافي (اختياري)","required":false,"accept":"application/pdf","maxFiles":1}
  ]'::jsonb,
  'b0e8400e-d29f-41d4-a716-446655440000'::uuid
)
on conflict (share_code) do update set
  title = excluded.title,
  description = excluded.description,
  deadline_at = excluded.deadline_at,
  fields = excluded.fields,
  teacher_view_token = excluded.teacher_view_token;

insert into public.teachers (id, full_name, phone_e164)
values (
  'c0e8400e-d29f-41d4-a716-446655440001'::uuid,
  'معلّم تجريبي',
  '966500000000'
)
on conflict (phone_e164) do update set
  full_name = excluded.full_name;

update public.assignments
set teacher_id = 'c0e8400e-d29f-41d4-a716-446655440001'::uuid
where id = 'a0e8400e-d29f-41d4-a716-446655440000'::uuid;
