import { useEffect, useState } from 'react'
import { teacherLogin } from '../lib/assignmentApi'
import { consumePostRegisterLogin } from '../lib/postRegisterLogin'
import { ensureMockDemoTeacher } from '../lib/teacherMockStore'
import { getTeacherSession } from '../lib/teacherSession'
import { isSupabaseEnabled } from '../lib/supabaseClient'

type Props = { go: (path: string) => void }

export function HomePage({ go }: Props) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
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

  /** بيانات من لوحة الإدارة: تعبئة الحقول، واختياريًا محاولة دخول تلقائية */
  useEffect(() => {
    if (getTeacherSession()) return
    const pending = consumePostRegisterLogin()
    if (!pending) return
    setFullName(pending.fullName)
    setPhone(pending.phone)
    setErr(null)
    if (pending.autoLogin === false) return
    setBusy(true)
    void (async () => {
      const r = await teacherLogin(pending.fullName, pending.phone)
      setBusy(false)
      if (r.ok) {
        go('/teacher/new')
        return
      }
      setErr(r.message)
    })()
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
        <h1 className="home-title">تسجيل دخول</h1>
        <p className="home-lead muted" style={{ marginTop: '0.5rem', maxWidth: '32rem' }}>
          يُقارَن الاسم ورقم الجوال مع بيانات المعلّمين المسجّلين. إذا تطابقتان مع السجلّ، يتم تسجيل
          الدخول تلقائيًا.
        </p>
      </header>

      <div className="section-card panel" style={{ maxWidth: '28rem', margin: '0 auto' }}>
        <form onSubmit={onLogin} autoComplete="off">
          <label className="field">
            <span className="field-label">الاسم الكامل</span>
            <input
              className="input"
              name="schoolify-teacher-name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                if (err) setErr(null)
              }}
              autoComplete="off"
              required
              minLength={2}
            />
          </label>
          <label className="field">
            <span className="field-label">رقم الجوال</span>
            <input
              className="input"
              name="schoolify-teacher-phone"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (err) setErr(null)
              }}
              autoComplete="off"
              required
              minLength={8}
            />
          </label>
          {err ? <p className="form-error">{err}</p> : null}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'تحقق وتسجيل الدخول'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
