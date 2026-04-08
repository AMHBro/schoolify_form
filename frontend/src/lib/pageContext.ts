/** نصوص سياقية موحّدة لرأس التطبيق */
export function getPageContext(pathname: string): { kicker: string; label: string } {
  const p = pathname.replace(/\/+$/, '') || '/'
  /* /system بدون أي إشارة في الرأس — الدخول يدويًا من العنوان فقط */
  if (p.startsWith('/system')) return { kicker: 'Schoolify', label: '' }
  if (p.startsWith('/teacher/new'))
    return { kicker: 'الأستاذ', label: 'إنشاء واجب' }
  if (p.startsWith('/teacher'))
    return { kicker: 'الأستاذ', label: 'الواجبات والتسليمات' }
  if (p.startsWith('/s/')) return { kicker: 'طالب', label: 'نموذج التسليم' }
  return { kicker: 'أستاذ', label: 'تسجيل الدخول' }
}
