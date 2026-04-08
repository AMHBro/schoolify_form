/** مواءمة مع public.normalize_teacher_phone في Supabase */

export function normalizeTeacherPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
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
  return raw.trim().replace(/\s+/g, ' ')
}
