/** مواءمة مع public.normalize_teacher_phone في Supabase */

/** تحويل الأرقام العربية/الفارسية (٠١٢…) إلى 012… كما يفعل translate في Postgres */
export function toWesternDigits(raw: string): string {
  let out = ''
  for (const ch of raw) {
    const c = ch.codePointAt(0) ?? 0
    if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660)
    else if (c >= 0x06f0 && c <= 0x06f9) out += String(c - 0x06f0)
    else out += ch
  }
  return out
}

/** توازن مع public.normalize_teacher_full_name (بدون NFC حتى لا يختلف عن ما في Postgres) */
export function normalizeTeacherNameForRpc(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
    .replace(/[\t\v\f\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeTeacherPhone(raw: string): string {
  const d = toWesternDigits(raw).replace(/\D/g, '')
  if (!d) return ''
  if (/^964[0-9]{9,}$/.test(d)) return d
  if (/^966[0-9]{8,}$/.test(d)) return d
  if (/^07[0-9]{9}$/.test(d)) return `964${d.slice(1)}`
  if (d.length === 10 && /^7[0-9]{9}$/.test(d)) return `964${d}`
  if (/^05[0-9]{8}$/.test(d)) return `966${d.slice(1)}`
  if (d.length === 9 && /^5[0-9]{8}$/.test(d)) return `966${d}`
  return d
}

export function normalizeTeacherName(raw: string): string {
  return normalizeTeacherNameForRpc(raw)
}
