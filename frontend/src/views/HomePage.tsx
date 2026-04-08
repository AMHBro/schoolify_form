import { useEffect, useState } from 'react'
import { teacherLogin } from '../lib/assignmentApi'
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
      </header>

      <div className="section-card panel" style={{ maxWidth: '28rem', margin: '0 auto' }}>
        <form onSubmit={onLogin} autoComplete="off">
          <label className="field">
            <span className="field-label">الاسم الكامل</span>
            <input
              className="input"
              name="schoolify-teacher-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          {err ? <p className="form-error">{err}</p> : null}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? '…' : 'دخول'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
