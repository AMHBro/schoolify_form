import { useEffect, useState } from 'react'
import { teacherLogin } from '../lib/assignmentApi'
import { ensureMockDemoTeacher } from '../lib/teacherMockStore'
import { getTeacherSession } from '../lib/teacherSession'
import { isSupabaseEnabled } from '../lib/supabaseClient'

type Props = { go: (path: string) => void }

export function HomePage({ go }: Props) {
  const [fullName, setFullName] = useState('معلّم تجريبي')
  const [phone, setPhone] = useState('966500000000')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (getTeacherSession()) {
      go('/teacher')
      return
    }
    if (!isSupabaseEnabled()) {
      ensureMockDemoTeacher()
    }
  }, [go])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const r = await teacherLogin(fullName, phone)
      if (!r.ok) {
        setErr(r.message)
        return
      }
      go('/teacher')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home-wrap">
      <header className="home-hero panel">
        <p className="home-eyebrow">Schoolify</p>
        <h1 className="home-title">تسجيل دخول الأساتذة</h1>
        <p className="home-lead muted">
          حساب واحد تجريبي جاهز أدناه. الطلاب يستخدمون رابط التسليم فقط ولا يحتاجون
          تسجيل دخول.
        </p>
      </header>

      <div className="section-card panel" style={{ maxWidth: '28rem', margin: '0 auto' }}>
        <div className="inline-hint" style={{ marginBottom: '1rem' }}>
          <strong>أستاذ تجريبي</strong> — انسخ أو عدّل إن أنشأت المعلّم في Supabase عبر{' '}
          <code className="inline-code">seed_demo.sql</code>:
          <ul style={{ margin: '0.5rem 0 0', paddingInlineStart: '1.25rem' }}>
            <li>
              الاسم: <code className="inline-code">معلّم تجريبي</code>
            </li>
            <li dir="ltr" style={{ textAlign: 'right' }}>
              الجوال: <code className="inline-code">966500000000</code>
            </li>
          </ul>
          {!isSupabaseEnabled() ? (
            <p className="muted small" style={{ margin: '0.5rem 0 0' }}>
              الوضع المحلي: الحساب يُنشأ تلقائيًا في المتصفح؛ اضغط «دخول» مباشرة.
            </p>
          ) : (
            <p className="muted small" style={{ margin: '0.5rem 0 0' }}>
              مع Supabase: نفّذ هجرات المعلّمين ثم <code className="inline-code">seed_demo.sql</code>{' '}
              لإنشاء نفس الحساب في القاعدة.
            </p>
          )}
        </div>

        <form onSubmit={onLogin}>
          <label className="field">
            <span className="field-label">الاسم الكامل</span>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="معلّم تجريبي"
              required
              minLength={2}
            />
          </label>
          <label className="field">
            <span className="field-label">رقم الجوال</span>
            <span className="muted small" style={{ display: 'block', marginBottom: '0.35rem' }}>
              أرقام فقط؛ استخدم نفس الصيغة المخزّنة (مثال مع مفتاح الدولة).
            </span>
            <input
              className="input"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="966500000000"
              required
            />
          </label>
          {err ? <p className="form-error">{err}</p> : null}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'جارٍ الدخول…' : 'دخول'}
            </button>
          </div>
        </form>
      </div>

      <p className="muted small home-demo-note" style={{ textAlign: 'center' }}>
        الطلاب: رابط مثل <code className="inline-code">/s/DEMO2024</code> فقط.
      </p>
    </div>
  )
}
