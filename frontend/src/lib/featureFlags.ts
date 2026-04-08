/** تفعيل واجهة/اختصار نموذج طالب تجريبي (مثلاً DEMO2024) لبيئة التطوير فقط */
export function allowStudentDemo(): boolean {
  return import.meta.env.VITE_ALLOW_STUDENT_DEMO === 'true'
}

/** لوحة /system تعمل فقط على الجهاز المحلي، لا من استضافة الإنتاج */
function isLocalSystemAdminHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  if (!h) return false
  const n = h.toLowerCase()
  return n === 'localhost' || n === '127.0.0.1' || n === '::1'
}

/**
 * السماح بتحميل صفحة /system عند فتح العنوان يدويًا (لا روابط في الواجهة).
 * شرطان: VITE_ENABLE_SYSTEM_ADMIN_UI=true والمتصفح على محلي فقط — النشر على الإنترنت لا يفعلها حتى مع الـ env.
 */
export function showSystemAdminUi(): boolean {
  return (
    import.meta.env.VITE_ENABLE_SYSTEM_ADMIN_UI === 'true' &&
    isLocalSystemAdminHost()
  )
}
