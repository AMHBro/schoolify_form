/** تفعيل واجهة/اختصار نموذج طالب تجريبي (مثلاً DEMO2024) لبيئة التطوير فقط */
export function allowStudentDemo(): boolean {
  return import.meta.env.VITE_ALLOW_STUDENT_DEMO === 'true'
}
