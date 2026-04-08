import { useEffect, useState } from 'react'
import { teacherLogin, teacherRegister } from '../lib/assignmentApi'
import { getTeacherSession } from '../lib/teacherSession'

type Props = { go: (path: string) => void }

export function HomePage({ go }: Props) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [okRegister, setOkRegister] = useState<string | null>(null)

  useEffect(() => {
    if (getTeacherSession()) go('/teacher')
  }, [go])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setOkRegister(null)
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

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setOkRegister(null)
    setBusy(true)
    try {
      const r = await teacherRegister(fullName, phone)
      if (!r.ok) {
        setErr(r.message)
        return
      }
      setOkRegister('تم إنشاء الحساب. يمكنك تسجيل الدخول الآن بنفس الاسم والرقم.')
      setMode('login')
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
          أدخل <strong>الاسم الكامل</strong> كما طُلب عند التسجيل، و<strong>رقم الجوال</strong>{' '}
          (أرقام فقط أو مع مفتاح الدولة). روابط الطلاب تعمل دون حساب.
        </p>
      </header>

      <div className="section-card panel" style={{ maxWidth: '28rem', margin: '0 auto' }}>
        <div className="home-actions" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn secondary ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('login')
              setErr(null)
            }}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            className={`btn secondary ${mode === 'register' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('register')
              setErr(null)
              setOkRegister(null)
            }}
          >
            تسجيل جديد
          </button>
        </div>

        <form onSubmit={mode === 'login' ? onLogin : onRegister}>
          <label className="field">
            <span className="field-label">الاسم الكامل</span>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              minLength={2}
            />
          </label>
          <label className="field">
            <span className="field-label">رقم الجوال</span>
            <input
              className="input"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
          </label>
          {err ? <p className="form-error">{err}</p> : null}
          {okRegister ? <p className="inline-hint">{okRegister}</p> : null}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy
                ? 'جارٍ المعالجة…'
                : mode === 'login'
                  ? 'دخول'
                  : 'إنشاء حساب'}
            </button>
          </div>
        </form>
      </div>

      <p className="muted small home-demo-note" style={{ textAlign: 'center' }}>
        الطلاب يفتحون رابط التسليم فقط (مثل /s/XXXX) ولا يحتاجون هذه الصفحة.
      </p>
    </div>
  )
}
