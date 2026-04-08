-- مفتاح إدارة النظام الافتراضي لـ /system (يُستبدل أي قيمة سابقة لصف id=1)
-- عام في المستودع — غيّره من Supabase SQL Editor بعد الترحيل إن أردت سرّاً خاصاً بك.

UPDATE public.system_admin_config
SET secret_key = 'SfAdm-46fbfa75b3584dccac46de23'
WHERE id = 1;
