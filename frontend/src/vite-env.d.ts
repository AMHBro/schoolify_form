/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_ASSIGNMENT_ID?: string
  readonly VITE_SUPABASE_TEACHER_TOKEN?: string
  /** عند true يظهر اختصار تجربة نموذج الطالب محلياً (DEMO2024) */
  readonly VITE_ALLOW_STUDENT_DEMO?: string
  /** مفتاح لوحة النظام في الوضع المحلي فقط (افتراضي schoolify-dev-admin) */
  readonly VITE_SYSTEM_ADMIN_MOCK_KEY?: string
  /** عند true على localhost فقط: مسار /system */
  readonly VITE_ENABLE_SYSTEM_ADMIN_UI?: string
  /** عند true في البناء: مسار /system على الإنتاج (مثل Vercel) — أعِد النشر بعد التعديل */
  readonly VITE_ALLOW_SYSTEM_ADMIN_PRODUCTION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
