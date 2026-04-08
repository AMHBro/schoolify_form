import { useCallback, useEffect, useState } from 'react'
import {
  systemAdminDeleteAssignment,
  systemAdminDeleteTeacher,
  systemAdminListAssignments,
  systemAdminListTeachers,
  systemAdminRegisterTeacher,
  teacherLogin,
  type SystemAdminAssignmentRow,
  type SystemAdminTeacherRow,
} from '../lib/assignmentApi'
import { setPostRegisterLogin } from '../lib/postRegisterLogin'
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
  const [deleteTeacherBusyId, setDeleteTeacherBusyId] = useState<string | null>(
    null
  )

  const refreshLists = useCallback(async () => {
    const key = getSystemAdminSecret()
    if (!key) return
    setListBusy(true)
    try {
      const [tr, ar] = await Promise.all([
        systemAdminListTeachers(key),
        systemAdminListAssignments(key),
      ])
      if (tr.ok === false) {
        clearSystemAdminSecret()
        setUnlocked(false)
        setUnlockErr(tr.message)
        return
      }
      if (ar.ok === false) {
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
      if (r.ok === false) {
        clearSystemAdminSecret()
        setUnlockErr(r.message)
        setBooting(false)
        return
      }
      const ar = await systemAdminListAssignments(existing)
      if (!on) return
      if (ar.ok === false) {
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
      if (r.ok === false) {
        setUnlockErr(r.message)
        return
      }
      const ar = await systemAdminListAssignments(trimmed)
      if (ar.ok === false) {
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
    const savedName = newName.trim()
    const savedPhone = newPhone.trim()
    setAddMsg(null)
    setAddBusy(true)
    try {
      const r = await systemAdminRegisterTeacher(key, savedName, savedPhone)
      if (r.ok === false) {
        setAddMsg(r.message)
        return
      }
      await refreshLists()
      setNewName('')
      setNewPhone('')
      const login = await teacherLogin(savedName, savedPhone)
      if (login.ok === false) {
        setPostRegisterLogin({ fullName: savedName, phone: savedPhone })
        setAddMsg(`تم الحفظ. جارٍ فتح الصفحة الرئيسية لمحاولة الدخول تلقائيًا…`)
        navigate('/')
        return
      }
      navigate('/teacher/new')
    } finally {
      setAddBusy(false)
    }
  }

  const onDeleteTeacher = async (row: SystemAdminTeacherRow) => {
    const key = getSystemAdminSecret()
    if (!key) return
    const ok = window.confirm(`حذف المعلّم «${row.fullName}»؟`)
    if (!ok) return
    setDeleteTeacherBusyId(row.id)
    try {
      const r = await systemAdminDeleteTeacher(key, row.id)
      if (r.ok === false) {
        window.alert(r.message)
        return
      }
      await refreshLists()
    } finally {
      setDeleteTeacherBusyId(null)
    }
  }

  const onDeleteAssignment = async (row: SystemAdminAssignmentRow) => {
    const key = getSystemAdminSecret()
    if (!key) return
    const ok = window.confirm(`حذف «${row.title}»؟`)
    if (!ok) return
    setDeleteBusyId(row.id)
    try {
      const r = await systemAdminDeleteAssignment(key, row.id)
      if (r.ok === false) {
        window.alert(r.message)
        return
      }
      await refreshLists()
    } finally {
      setDeleteBusyId(null)
    }
  }

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
          <h1 className="form-title">إدارة النظام</h1>
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
          <h1 className="form-title">إدارة النظام</h1>
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
            خروج
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
              />
            </label>
            <label className="field">
              <span className="field-label">رقم الجوال</span>
              <input
                className="input"
                dir="ltr"
                inputMode="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <div className="form-actions system-admin-add-actions">
              <button type="submit" className="btn primary" disabled={addBusy}>
                {addBusy ? '…' : 'حفظ'}
              </button>
            </div>
          </form>
          {addMsg ? (
            <p className="inline-hint small form-error">{addMsg}</p>
          ) : null}

          <h2 className="system-admin-h2">المعلّمون</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الجوال</th>
                  <th>تاريخ الإنشاء</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
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
                      <td>
                        <button
                          type="button"
                          className="btn danger-ghost"
                          disabled={deleteTeacherBusyId === t.id}
                          onClick={() => void onDeleteTeacher(t)}
                        >
                          {deleteTeacherBusyId === t.id ? '…' : 'حذف'}
                        </button>
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
          <h2 className="system-admin-h2">الواجبات</h2>
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
