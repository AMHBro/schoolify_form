import { useCallback, useEffect, useState } from 'react'
import { isSupabaseEnabled } from '../lib/supabaseClient'
import {
  systemAdminDeleteAssignment,
  systemAdminListAssignments,
  systemAdminListTeachers,
  systemAdminRegisterTeacher,
  type SystemAdminAssignmentRow,
  type SystemAdminTeacherRow,
} from '../lib/assignmentApi'
import {
  clearSystemAdminSecret,
  getSystemAdminSecret,
  setSystemAdminSecret,
} from '../lib/systemAdminSession'

type Tab = 'teachers' | 'assignments'

type Props = {
  navigate: (path: string) => void
}

export function SystemAdminPage({ navigate }: Props) {
  const [booting, setBooting] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [unlockErr, setUnlockErr] = useState<string | null>(null)
  const [unlockBusy, setUnlockBusy] = useState(false)

  const [tab, setTab] = useState<Tab>('teachers')
  const [teachers, setTeachers] = useState<SystemAdminTeacherRow[]>([])
  const [assignments, setAssignments] = useState<SystemAdminAssignmentRow[]>([])
  const [listBusy, setListBusy] = useState(false)

  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addMsg, setAddMsg] = useState<string | null>(null)

  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)

  const refreshLists = useCallback(async () => {
    const key = getSystemAdminSecret()
    if (!key) return
    setListBusy(true)
    try {
      const [tr, ar] = await Promise.all([
        systemAdminListTeachers(key),
        systemAdminListAssignments(key),
      ])
      if (!tr.ok) {
        clearSystemAdminSecret()
        setUnlocked(false)
        setUnlockErr(tr.message)
        return
      }
      if (!ar.ok) {
        clearSystemAdminSecret()
        setUnlocked(false)
        setUnlockErr(ar.message)
        return
      }
      setTeachers(tr.rows)
      setAssignments(ar.rows)
    } finally {
      setListBusy(false)
    }
  }, [])

  useEffect(() => {
    let on = true
    ;(async () => {
      const existing = getSystemAdminSecret()
      if (!existing) {
        if (on) setBooting(false)
        return
      }
      const r = await systemAdminListTeachers(existing)
      if (!on) return
      if (!r.ok) {
        clearSystemAdminSecret()
        setUnlockErr(r.message)
        setBooting(false)
        return
      }
      const ar = await systemAdminListAssignments(existing)
      if (!on) return
      if (!ar.ok) {
        clearSystemAdminSecret()
        setUnlockErr(ar.message)
        setBooting(false)
        return
      }
      setUnlocked(true)
      setSecretInput(existing)
      setTeachers(r.rows)
      setAssignments(ar.rows)
      setBooting(false)
    })()
    return () => {
      on = false
    }
  }, [])

  const onUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setUnlockErr(null)
    setUnlockBusy(true)
    try {
      const trimmed = secretInput.trim()
      const r = await systemAdminListTeachers(trimmed)
      if (!r.ok) {
        setUnlockErr(r.message)
        return
      }
      const ar = await systemAdminListAssignments(trimmed)
      if (!ar.ok) {
        setUnlockErr(ar.message)
        return
      }
      setSystemAdminSecret(trimmed)
      setUnlocked(true)
      setTeachers(r.rows)
      setAssignments(ar.rows)
    } finally {
      setUnlockBusy(false)
    }
  }

  const onLogoutAdmin = () => {
    clearSystemAdminSecret()
    setUnlocked(false)
    setTeachers([])
    setAssignments([])
    setSecretInput('')
    setUnlockErr(null)
  }

  const onAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault()
    const key = getSystemAdminSecret()
    if (!key) return
    setAddMsg(null)
    setAddBusy(true)
    try {
      const r = await systemAdminRegisterTeacher(key, newName, newPhone)
      if (!r.ok) {
        setAddMsg(r.message)
        return
      }
      setNewName('')
      setNewPhone('')
      setAddMsg('تمت إضافة المعلّم.')
      await refreshLists()
    } finally {
      setAddBusy(false)
    }
  }

  const onDeleteAssignment = async (row: SystemAdminAssignmentRow) => {
    const key = getSystemAdminSecret()
    if (!key) return
    const ok = window.confirm(
      `حذف الواجب «${row.title}» (${row.shareCode})؟\nسيتم حذف التسليمات المرتبطة من قاعدة البيانات. ملفات التخزين قد تبقى حتى تنظيف يدوي.`
    )
    if (!ok) return
    setDeleteBusyId(row.id)
    try {
      const r = await systemAdminDeleteAssignment(key, row.id)
      if (!r.ok) {
        window.alert(r.message)
        return
      }
      await refreshLists()
    } finally {
      setDeleteBusyId(null)
    }
  }

  const mockHint =
    !isSupabaseEnabled() ? (
      <p className="muted small" style={{ marginTop: '0.75rem' }}>
        وضع محلي: المفتاح الافتراضي{' '}
        <code className="inline-code">schoolify-dev-admin</code> ما لم تضبط{' '}
        <code className="inline-code">VITE_SYSTEM_ADMIN_MOCK_KEY</code>.
      </p>
    ) : (
      <p className="muted small" style={{ marginTop: '0.75rem' }}>
        على Supabase: عيّن المفتاح عبر{' '}
        <code className="inline-code" dir="ltr">
          UPDATE system_admin_config SET secret_key = &apos;...&apos;;
        </code>{' '}
        ثم أدخل نفس القيمة هنا.
      </p>
    )

  if (booting) {
    return (
      <div className="panel system-admin-shell">
        <p className="muted">جارٍ التحميل…</p>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="panel system-admin-shell">
        <header className="form-head">
          <h1 className="form-title">لوحة إدارة النظام</h1>
          <p className="muted">
            أدخل مفتاح الإدارة السري. لا يستبدل تسجيل دخول الأستاذ.
          </p>
        </header>
        <form
          onSubmit={onUnlock}
          className="section-card"
          style={{ maxWidth: '26rem' }}
        >
          <label className="field">
            <span className="field-label">مفتاح الإدارة</span>
            <input
              className="input"
              dir="ltr"
              type="password"
              autoComplete="off"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {unlockErr ? <p className="form-error">{unlockErr}</p> : null}
          {mockHint}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn primary" disabled={unlockBusy}>
              {unlockBusy ? 'جارٍ التحقق…' : 'متابعة'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => navigate('/')}
            >
              الرئيسية
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="panel system-admin-shell">
      <header className="form-head system-admin-head">
        <div>
          <h1 className="form-title">لوحة إدارة النظام</h1>
          <p className="muted">
            إضافة معلّمين، عرض الواجبات، وحذف الواجبات.
          </p>
        </div>
        <div className="system-admin-head-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={() => void refreshLists()}
            disabled={listBusy}
          >
            {listBusy ? 'جارٍ التحديث…' : 'تحديث القوائم'}
          </button>
          <button type="button" className="btn secondary" onClick={onLogoutAdmin}>
            مسح مفتاح الإدارة
          </button>
          <button type="button" className="btn secondary" onClick={() => navigate('/')}>
            الرئيسية
          </button>
        </div>
      </header>

      <div className="system-admin-tabs" role="tablist" aria-label="أقسام الإدارة">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'teachers'}
          className={`nav-pill ${tab === 'teachers' ? 'is-active' : ''}`}
          onClick={() => setTab('teachers')}
        >
          المعلّمون
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'assignments'}
          className={`nav-pill ${tab === 'assignments' ? 'is-active' : ''}`}
          onClick={() => setTab('assignments')}
        >
          الواجبات
        </button>
      </div>

      {tab === 'teachers' ? (
        <div className="system-admin-section">
          <h2 className="system-admin-h2">إضافة معلّم</h2>
          <form
            onSubmit={onAddTeacher}
            className="system-admin-inline-form"
          >
            <label className="field">
              <span className="field-label">الاسم الكامل</span>
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                minLength={2}
                placeholder="اسم المعلّم"
              />
            </label>
            <label className="field">
              <span className="field-label">الجوال (أرقام)</span>
              <input
                className="input"
                dir="ltr"
                inputMode="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                placeholder="9665xxxxxxxx"
              />
            </label>
            <div className="form-actions system-admin-add-actions">
              <button type="submit" className="btn primary" disabled={addBusy}>
                {addBusy ? 'جارٍ الإضافة…' : 'إضافة'}
              </button>
            </div>
          </form>
          {addMsg ? <p className="inline-hint small">{addMsg}</p> : null}

          <h2 className="system-admin-h2">قائمة المعلّمين</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      لا يوجد معلّمون بعد.
                    </td>
                  </tr>
                ) : (
                  teachers.map((t) => (
                    <tr key={t.id}>
                      <td>{t.fullName}</td>
                      <td dir="ltr">{t.phone}</td>
                      <td className="muted">
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleString('ar-SA', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="system-admin-section">
          <h2 className="system-admin-h2">جميع الواجبات</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>كود المشاركة</th>
                  <th>المعلّم</th>
                  <th>التسليمات</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      لا توجد واجبات.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>
                        <code className="inline-code" dir="ltr">
                          {a.shareCode}
                        </code>
                      </td>
                      <td>{a.teacherName ?? '—'}</td>
                      <td>{a.submissionCount}</td>
                      <td>
                        <button
                          type="button"
                          className="btn danger-ghost"
                          disabled={deleteBusyId === a.id}
                          onClick={() => void onDeleteAssignment(a)}
                        >
                          {deleteBusyId === a.id ? '…' : 'حذف'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
