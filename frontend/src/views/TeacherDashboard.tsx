import { useCallback, useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Lightbox } from '../components/Lightbox'
import type { AssignmentSchema, SubmissionRecord } from '../types/assignment'
import { fetchTeacherDashboard } from '../lib/assignmentApi'
import { isSupabaseEnabled } from '../lib/supabaseClient'

type SortMode = 'name' | 'submittedAt'
type View = 'welcome' | 'board'

const USE_MOCK = !isSupabaseEnabled()

function sanitizeFolderName(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80) || 'student'
}

async function blobFromUrl(url: string): Promise<Blob | null> {
  if (!url || url === '#') return null
  try {
    const r = await fetch(url, { mode: 'cors' })
    if (!r.ok) return null
    return r.blob()
  } catch {
    return null
  }
}

type Props = {
  navigate: (path: string) => void
  search: string
}

export function TeacherDashboard({ navigate, search }: Props) {
  const hasQuery = useMemo(() => {
    const q = new URLSearchParams(search)
    return !!(q.get('aid')?.trim() && q.get('tv')?.trim())
  }, [search])

  const hasEnv = useMemo(
    () =>
      !USE_MOCK &&
      !!(
        import.meta.env.VITE_SUPABASE_ASSIGNMENT_ID?.trim() &&
        import.meta.env.VITE_SUPABASE_TEACHER_TOKEN?.trim()
      ),
    []
  )

  const [view, setView] = useState<View>(() =>
    hasQuery || hasEnv ? 'board' : 'welcome'
  )
  const [assignment, setAssignment] = useState<AssignmentSchema | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [loading, setLoading] = useState(() => hasQuery || hasEnv)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('submittedAt')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)

  const [openAid, setOpenAid] = useState('')
  const [openTv, setOpenTv] = useState('')

  useEffect(() => {
    let on = true
    const q = new URLSearchParams(search)
    const qAid = q.get('aid')?.trim()
    const qTv = q.get('tv')?.trim()
    const hq = !!(qAid && qTv)
    const he =
      !USE_MOCK &&
      !!(
        import.meta.env.VITE_SUPABASE_ASSIGNMENT_ID?.trim() &&
        import.meta.env.VITE_SUPABASE_TEACHER_TOKEN?.trim()
      )

    if (!hq && !he && USE_MOCK) {
      setView('welcome')
      setLoading(false)
      setAssignment(null)
      setSubmissions([])
      setBannerError(null)
      return () => {
        on = false
      }
    }

    setLoading(true)
    setBannerError(null)

    ;(async () => {
      try {
        const explicit = hq
          ? { assignmentId: qAid!, teacherToken: qTv! }
          : null
        const data = await fetchTeacherDashboard(explicit)
        if (!on) return
        setAssignment(data.assignment)
        setSubmissions(data.submissions)
        setView('board')
      } catch (e) {
        if (!on) return
        setAssignment(null)
        setSubmissions([])
        if (e instanceof Error && e.message === 'NO_CREDS') {
          setView('welcome')
        } else if (e instanceof Error && e.message === 'NOT_FOUND') {
          setView('welcome')
          setBannerError('معرّف الواجب أو رمز المراجعة غير صحيح.')
        } else {
          setView('welcome')
          setBannerError('تعذّر تحميل اللوحة. تحقق من الشبكة أو الصلاحيات.')
        }
      } finally {
        if (on) setLoading(false)
      }
    })()

    return () => {
      on = false
    }
  }, [search])

  const sorted = useMemo(() => {
    const copy = [...submissions]
    if (sort === 'name') {
      copy.sort((a, b) =>
        a.studentName.localeCompare(b.studentName, 'ar', { sensitivity: 'base' })
      )
    } else {
      copy.sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
    }
    return copy
  }, [submissions, sort])

  const exportZip = useCallback(async () => {
    if (!assignment) return
    setZipping(true)
    try {
      const zip = new JSZip()
      const root = zip.folder(sanitizeFolderName(assignment.title))
      for (const s of sorted) {
        const folder = root?.folder(sanitizeFolderName(s.studentName))
        folder?.file(
          'metadata.json',
          JSON.stringify(
            {
              studentName: s.studentName,
              submittedAt: s.submittedAt,
              textAnswer: s.textAnswer ?? '',
            },
            null,
            2
          )
        )
        if (s.textAnswer) folder?.file('ملاحظات.txt', s.textAnswer)
        for (const f of s.files) {
          const blob = await blobFromUrl(f.url)
          if (blob) folder?.file(f.name, blob)
          else folder?.file(`${f.name}.رابط.txt`, f.url)
        }
      }
      const out = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(out)
      a.download = `${sanitizeFolderName(assignment.title)}_تسليمات.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setZipping(false)
    }
  }, [assignment, sorted])

  if (view === 'welcome' && !loading) {
    return (
      <div className="teacher-welcome page-stack">
        <header className="panel welcome-hero">
          <h1 className="page-title">لوحة الأستاذ</h1>
          <p className="lead muted">
            أنشئ واجبًا وحدّد الحقول؛ يُولَّد رابط للطلاب ورابط مراجعة لك فقط. احفظ
            رابط المراجعة في مكان آمن.
          </p>
        </header>

        <div className="welcome-split">
        <section className="section-card panel section-card-accent">
          <h2 className="section-card-title">واجب جديد</h2>
          <p className="muted small">
            تعريف المتطلبات ثم توليد روابط المشاركة والمراجعة.
          </p>
          <div className="home-actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate('/teacher/new')}
            >
              إنشاء واجب ورابط مشاركة
            </button>
          </div>
        </section>

        <section className="section-card panel">
          <h2 className="section-card-title">واجب موجود</h2>
          <p className="muted small">
            من رابط المراجعة بعد الإنشاء: الصِق المعرّف (UUID) والرمز السري.
          </p>
          <label className="field">
            <span className="field-label">معرّف الواجب (UUID)</span>
            <input
              className="input"
              dir="ltr"
              value={openAid}
              onChange={(e) => setOpenAid(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">رمز المراجعة</span>
            <input
              className="input"
              dir="ltr"
              value={openTv}
              onChange={(e) => setOpenTv(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn secondary"
            disabled={!openAid.trim() || !openTv.trim()}
            onClick={() =>
              navigate(
                `/teacher?aid=${encodeURIComponent(openAid.trim())}&tv=${encodeURIComponent(openTv.trim())}`
              )
            }
          >
            فتح لوحة التسليمات
          </button>
        </section>
        </div>

        {bannerError ? (
          <div className="panel form-error" role="alert">
            {bannerError}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="teacher-layout">
      <header className="teacher-head">
        <div>
          <h1 className="page-title">لوحة المراجعة</h1>
          <p className="muted">{assignment?.title ?? '—'}</p>
        </div>
        <div className="teacher-toolbar">
          <button
            type="button"
            className="btn secondary"
            onClick={() => navigate('/teacher/new')}
          >
            إنشاء واجب جديد
          </button>
          <label className="sort-label">
            <span>الفرز</span>
            <select
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="submittedAt">حسب وقت التسليم</option>
              <option value="name">حسب اسم الطالب (أبجدي)</option>
            </select>
          </label>
          <button
            type="button"
            className="btn secondary"
            disabled={zipping || sorted.length === 0}
            onClick={exportZip}
          >
            {zipping ? 'جارٍ الضغط…' : 'تصدير ZIP لجميع الملفات'}
          </button>
        </div>
      </header>

      {bannerError && view === 'board' ? (
        <div className="panel form-error" role="alert">
          {bannerError}
        </div>
      ) : null}

      {assignment && (
        <section className="share-banner panel">
          <div>
            <h2 className="banner-title">مشاركة الواجب</h2>
            <p className="muted">
              رابط الطالب:{' '}
              <code className="inline-code">
                {`${window.location.origin.replace(/\/$/, '')}${assignment.publicUrl}`}
              </code>
            </p>
            <p className="muted">
              كود المشاركة: <strong>{assignment.shareCode}</strong>
            </p>
          </div>
        </section>
      )}

      {loading ? (
        <p className="muted">جارٍ التحميل…</p>
      ) : (
        <ul className="card-grid">
          {sorted.map((s) => (
            <li key={s.id} className="submission-card panel">
              <header className="card-head">
                <h3 className="card-name">{s.studentName}</h3>
                <time className="card-time" dateTime={s.submittedAt}>
                  {new Date(s.submittedAt).toLocaleString('ar-SA', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </header>
              {s.textAnswer && (
                <p className="card-text">{s.textAnswer}</p>
              )}
              <div className="card-gallery">
                {s.files
                  .filter((f) => f.isImage)
                  .map((f) => (
                    <button
                      key={f.name + f.url}
                      type="button"
                      className="gallery-thumb"
                      onClick={() => setLightbox(f.url)}
                    >
                      <img src={f.url} alt="" />
                    </button>
                  ))}
              </div>
              {s.files.some((f) => !f.isImage) && (
                <ul className="file-list">
                  {s.files
                    .filter((f) => !f.isImage)
                    .map((f) => (
                      <li key={f.name}>
                        <a href={f.url} className="file-link">
                          {f.name}
                        </a>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  )
}
