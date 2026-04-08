import { useEffect, useState } from 'react'
import { DynamicStudentForm } from '../components/DynamicStudentForm'
import type { AssignmentSchema } from '../types/assignment'
import { allowStudentDemo } from '../lib/featureFlags'
import { fetchAssignmentByCode } from '../lib/assignmentApi'
import { isSupabaseEnabled } from '../lib/supabaseClient'

type Props = { shareCode: string }

export function StudentAssignmentPage({ shareCode }: Props) {
  const [schema, setSchema] = useState<AssignmentSchema | null | undefined>(
    undefined
  )

  useEffect(() => {
    let on = true
    ;(async () => {
      const a = await fetchAssignmentByCode(shareCode)
      if (on) setSchema(a)
    })()
    return () => {
      on = false
    }
  }, [shareCode])

  if (schema === undefined) {
    return (
      <div className="page-stack">
        <div className="panel student-shell">
          <p className="muted">جارٍ تحميل الواجب…</p>
        </div>
      </div>
    )
  }

  if (schema === null) {
    const codeInUrl = shareCode.trim() || '—'
    return (
      <div className="page-stack">
        <div className="panel closed-panel student-shell">
          <h2>الرابط غير صالح أو الواجب غير متوفر</h2>
          <p className="muted">
            يفتح نموذج التسليم عبر الرابط الذي يشاركه الأستاذ فقط. تحقق من نسخ
            الرابط كاملًا دون حذف جزء من الكود.
          </p>
          <p className="muted small" style={{ marginTop: '0.75rem' }}>
            الكود في هذا الرابط:{' '}
            <code className="inline-code" dir="ltr">
              {codeInUrl}
            </code>
          </p>

          {isSupabaseEnabled() ? (
            <div className="inline-hint" style={{ marginTop: '1rem' }}>
              <strong>باستخدام Supabase:</strong> تأكد أن الأستاذ نفّذ ملفات SQL في
              المشروع، وأن الواجب ما زال موجودًا في الجدول. جرّب فتح الرابط بحروف
              كبيرة إن نسخت الكود يدويًا. في لوحة Supabase يمكن التحقق من عمود{' '}
              <code className="inline-code">share_code</code> في الجدول{' '}
              <code className="inline-code">assignments</code>.
            </div>
          ) : (
            <div className="inline-hint" style={{ marginTop: '1rem' }}>
              <strong>الوضع المحلي (بدون Supabase):</strong> الواجب يُحفظ في متصفح
              منشئ الواجب فقط. إذا فتح الطالب الرابط من جهاز أو متصفح آخر لن يظهر
              الواجب. للمشاركة الحقيقية: اربط المشروع بـ Supabase (متغيرات{' '}
              <code className="inline-code">VITE_SUPABASE_URL</code> و{' '}
              <code className="inline-code">VITE_SUPABASE_ANON_KEY</code>) وأنشئ
              الواجب مرة أخرى بعد ربط القاعدة.
            </div>
          )}

          {allowStudentDemo() ? (
            <p className="muted small" style={{ marginTop: '1rem' }}>
              تجربة محلية:{' '}
              <a className="file-link" href="/s/DEMO2024">
                /s/DEMO2024
              </a>{' '}
              عند <code className="inline-code">VITE_ALLOW_STUDENT_DEMO=true</code>.
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <DynamicStudentForm schema={schema} />
    </div>
  )
}
