-- إضافة حسابات الأساتذة دفعة واحدة
-- ملاحظة: النظام الحالي يستخدم الاسم + رقم الهاتف للدخول، ولا يستخدم كلمة مرور للأستاذ.
-- الأكواد المرسلة من المستخدم محفوظة هنا كمرجع فقط:
-- علي السوداني: ZLPYHDHK
-- محمد اللامي: FKEPRPOL
-- عمر عادل: TDLVLPPX
-- حسين علي السعيدي: OCBIIHAH
-- محمد كزار: EHIMEXET
-- رضا رائد: ETQRWQTJ
-- علي رحيم: PHFPLDXG

insert into public.teachers (full_name, phone_e164)
values
  (public.normalize_teacher_full_name('علي السوداني'), public.normalize_teacher_phone('+964 771 373 4877')),
  (public.normalize_teacher_full_name('محمد اللامي'), public.normalize_teacher_phone('+964 771 581 5699')),
  (public.normalize_teacher_full_name('عمر عادل'), public.normalize_teacher_phone('+964 771 307 1703')),
  (public.normalize_teacher_full_name('حسين علي السعيدي'), public.normalize_teacher_phone('+964 770 603 4842')),
  (public.normalize_teacher_full_name('محمد كزار'), public.normalize_teacher_phone('+964 770 886 8161')),
  (public.normalize_teacher_full_name('رضا رائد'), public.normalize_teacher_phone('+964 772 434 5947')),
  (public.normalize_teacher_full_name('علي رحيم'), public.normalize_teacher_phone('+964 776 416 6231'))
on conflict (phone_e164) do update
set full_name = excluded.full_name;
