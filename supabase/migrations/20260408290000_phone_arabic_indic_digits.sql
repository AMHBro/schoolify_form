-- أرقام عربية/فارسية (٠١٢٣…) → 0123 قبل إزالة غير الأرقام؛ يتوافق مع لوحة المفاتيح العربية

create or replace function public.normalize_teacher_phone (raw text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := translate(
    coalesce(trim(raw), ''),
    '٠١٢٣٤٥٦٧٨٩' || '۰۱۲۳۴۵۶۷۸۹',
    '0123456789' || '0123456789'
  );
  v := nullif(regexp_replace(v, '\D', '', 'g'), '');
  if v is null then
    return null;
  end if;
  if v ~ '^964[0-9]{9,}$' then
    return v;
  end if;
  if v ~ '^966[0-9]{8,}$' then
    return v;
  end if;
  if v ~ '^07[0-9]{9}$' then
    return '964' || substr(v, 2);
  end if;
  if length(v) = 10 and v ~ '^7[0-9]{9}$' then
    return '964' || v;
  end if;
  if v ~ '^05[0-9]{8}$' then
    return '966' || substr(v, 2);
  end if;
  if length(v) = 9 and v ~ '^5[0-9]{8}$' then
    return '966' || v;
  end if;
  return v;
end;
$$;

update public.teachers
set
  phone_e164 = coalesce(
    public.normalize_teacher_phone(phone_e164),
    phone_e164
  );
