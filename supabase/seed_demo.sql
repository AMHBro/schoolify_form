-- بيانات تجريبية (اختياري) — نفّذ بعد الهجرة الرئيسية
-- يضيف واجبًا بكود DEMO2024 ومعرّفات ثابتة لتسهيل ملء frontend/.env

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
  'واجب تجريبي — Supabase',
  'بعد التشغيل انسخ القيم من frontend/.env.example إلى frontend/.env',
  now() + interval '7 days',
  'DEMO2024',
  '[
    {"id":"student_name","type":"text","label":"اسم الطالب","required":true},
    {"id":"answer_text","type":"text","label":"ملاحظات على الحل (اختياري)","required":false},
    {"id":"solution_images","type":"images","label":"صور الحل","required":true,"accept":"image/jpeg,image/png,image/webp","maxFiles":8},
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
