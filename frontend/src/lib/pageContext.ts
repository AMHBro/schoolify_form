/** نصوص سياقية موحّدة لرأس التطبيق */
export function getPageContext(pathname: string): { kicker: string; label: string } {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p.startsWith('/teacher/new'))
    return { kicker: 'الأستاذ', label: 'إنشاء واجب' }
  if (p.startsWith('/teacher'))
    return { kicker: 'الأستاذ', label: 'لوحة المراجعة' }
  if (p.startsWith('/s/')) return { kicker: 'طالب', label: 'نموذج التسليم' }
  return { kicker: 'Schoolify', label: 'التسليم الدراسي' }
}
