-- تعيين مفتاح لوحة إدارة النظام (/system)
-- بعد ترحيل 20260408300000_system_admin_preset_secret.sql يكون المفتاح المعيّن في المستودع — غيّره هنا إن رغبت.
-- نفّذ هذا الملف في Supabase → SQL Editor بعد تطبيق ترحيلات لوحة الإدارة.
-- ① غيّر السلسلة بين الأقواس أدناه إلى كلمة سرّ قوية (لا ترفع هذا الملف إن وضعت سراً حقيقياً).
-- ② نفّذ الاستعلام مرة واحدة.

UPDATE public.system_admin_config
SET secret_key = trim(replace('ضع_كلمة_السر_هنا', chr(10), ''))
WHERE id = 1;

-- إن أرجع UPDATE 0 صف: تأكد أن الجدول موجود (ترحيل 20260408240000_system_admin_dashboard.sql) ثم:
-- INSERT INTO public.system_admin_config (id, secret_key) VALUES (1, trim('ضع_كلمة_السر_هنا')) ON CONFLICT (id) DO UPDATE SET secret_key = excluded.secret_key;
