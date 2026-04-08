import { useCallback, useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Lightbox } from '../components/Lightbox'
import type { AssignmentSchema, SubmissionRecord } from '../types/assignment'
import {
  fetchTeacherDashboard,
  fetchTeacherDashboardForSession,
  listTeacherAssignments,
  type TeacherAssignmentListItem,
} from '../lib/assignmentApi'
import { getTeacherSession } from '../lib/teacherSession'

type SortMode = 'name' | 'submittedAt'

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
  const qParsed = useMemo(() => {
    const q = new URLSearchParams(search)
    return {
      aid: q.get('aid')?.trim() ?? '',
      tv: q.get('tv')?.trim() ?? '',
    }
  }, [search])

  const isLegacyBoard = !!(qParsed.aid && qParsed.tv)

  const [list, setList] = useState<TeacherAssignmentListItem[]>([])
  const [listLoading, setListLoading] = useState(false)

  const [assignment, setAssignment] = useState<AssignmentSchema | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const [sort, setSort] = useState<SortMode>('submittedAt')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)

  useEffect(() => {
    let on = true
    if (isLegacyBoard) {
      setBoardLoading(true)
      setBannerError(null)
      ;(async () => {
        try {
          const data = await fetchTeacherDashboard({
            assignmentId: qParsed.aid,
            teacherToken: qParsed.tv,
          })
          if (!on) return
          setAssignment(data.assignment)
          setSubmissions(data.submissions)
        } catch {
          if (!on) return
          setAssignment(null)
          setSubmissions([])
          setBannerError('تعذّر تحميل اللوحة. تحقق من المعرّف والرمز أو من الشبكة.')
        } finally {
          if (on) setBoardLoading(false)
        }
      })()
      return () => {
        on = false
      }
    }

    if (qParsed.aid && getTeacherSession()) {
      setBoardLoading(true)
      setBannerError(null)
      ;(async () => {
        try {
          const data = await fetchTeacherDashboardForSession(qParsed.aid)
          if (!on) return
          setAssignment(data.assignment)
          setSubmissions(data.submissions)
        } catch (e) {
          if (!on) return
          setAssignment(null)
          setSubmissions([])
          if (e instanceof Error && e.message === 'NOT_FOUND') {
            setBannerError('هذا الواجب غير موجود أو لا يخص حسابك.')
          } else {
            setBannerError('تعذّر تحميل التسليمات.')
          }
        } finally {
          if (on) setBoardLoading(false)
        }
      })()
      return () => {
        on = false
      }
    }

    if (!qParsed.aid && getTeacherSession()) {
      setListLoading(true)
      setAssignment(null)
      setSubmissions([])
      ;(async () => {
        try {
          const rows = await listTeacherAssignments()
          if (!on) return
          setList(rows)
        } finally {
          if (on) setListLoading(false)
        }
      })()
      return () => {
        on = false
      }
    }

    setList([])
    setAssignment(null)
    setSubmissions([])
    setListLoading(false)
    setBoardLoading(false)
    return () => {
      on = false
    }
  }, [search, qParsed.aid, qParsed.tv, isLegacyBoard])

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

  const openAssignment = (id: string) => {
    navigate(`/teacher?aid=${encodeURIComponent(id)}`)
  }

  const backToList = () => {
    navigate('/teacher')
  }

  const showBoard = isLegacyBoard || !!qParsed.aid

  if (!showBoard) {
    return (
      <div className="teacher-welcome page-stack">
        <header className="panel welcome-hero">
          <h1 className="page-title">واجباتي</h1>
        </header>

        <div className="home-actions" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn primary"
            onClick={() => navigate('/teacher/new')}
          >
            إنشاء واجب جديد
          </button>
        </div>

        {bannerError ? (
          <div className="panel form-error" role="alert">
            {bannerError}
          </div>
        ) : null}

        {listLoading ? (
          <p className="muted">جارٍ التحميل…</p>
        ) : list.length === 0 ? (
          <div className="panel">
            <p className="muted">لا توجد واجبات.</p>
          </div>
        ) : (
          <ul className="assignment-list">
            {list.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="panel assignment-list-item"
                  onClick={() => openAssignment(row.id)}
                >
                  <div className="assignment-list-main">
                    <h2 className="assignment-list-title">{row.title}</h2>
                    <p className="muted small">
                      كود المشاركة: <strong dir="ltr">{row.shareCode}</strong>
                      {' — '}
                      {row.submissionCount} تسليم
                    </p>
                  </div>
                  <span className="assignment-list-chevron" aria-hidden>
                    ‹
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="teacher-layout">
      <header className="teacher-head">
        <div>
          <h1 className="page-title">إجابات الطلاب</h1>
          <p className="muted">{assignment?.title ?? '—'}</p>
        </div>
        <div className="teacher-toolbar">
          {!isLegacyBoard ? (
            <button
              type="button"
              className="btn secondary"
              onClick={backToList}
            >
              ← كل الواجبات
            </button>
          ) : null}
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

      {bannerError ? (
        <div className="panel form-error" role="alert">
          {bannerError}
        </div>
      ) : null}

      {assignment && (
        <section className="share-banner panel">
          <div>
            <h2 className="banner-title">مشاركة</h2>
            <p className="muted">
              <code className="inline-code">
                {`${window.location.origin.replace(/\/$/, '')}${assignment.publicUrl}`}
              </code>
            </p>
            <p className="muted">
              <strong dir="ltr">{assignment.shareCode}</strong>
            </p>
          </div>
        </section>
      )}

      {boardLoading ? (
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
              {s.textAnswer && <p className="card-text">{s.textAnswer}</p>}
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
