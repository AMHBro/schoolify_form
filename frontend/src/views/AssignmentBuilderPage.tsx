import { useCallback, useState } from 'react'
import type { AssignmentField, FieldType } from '../types/assignment'
import {
  createAssignment,
  translateCreateError,
} from '../lib/assignmentApi'
function newId() {
  return `f_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function emptyField(): AssignmentField {
  return {
    id: newId(),
    type: 'text',
    label: '',
    required: false,
  }
}

type Props = {
  navigate: (path: string) => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function AssignmentBuilderPage({ navigate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadlineLocal, setDeadlineLocal] = useState('')
  const [shareCodeOpt, setShareCodeOpt] = useState('')
  const [fields, setFields] = useState<AssignmentField[]>([
    {
      id: 'student_name',
      type: 'text',
      label: 'اسم الطالب',
      required: true,
    },
    emptyField(),
  ])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{
    id: string
    shareCode: string
    teacherViewToken: string
  } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const addField = useCallback(() => {
    setFields((f) => [...f, emptyField()])
  }, [])

  const removeField = useCallback((index: number) => {
    setFields((f) => (f.length <= 1 ? f : f.filter((_, i) => i !== index)))
  }, [])

  const moveField = useCallback((index: number, delta: -1 | 1) => {
    setFields((f) => {
      const j = index + delta
      if (j < 0 || j >= f.length) return f
      const next = [...f]
      const a = next[index]!
      next[index] = next[j]!
      next[j] = a
      return next
    })
  }, [])

  const patchField = useCallback((index: number, patch: Partial<AssignmentField>) => {
    setFields((f) => f.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }, [])

  const insertNamePreset = useCallback(() => {
    setFields((f) => {
      const rest = f.filter((row) => row.id !== 'student_name')
      return [
        {
          id: 'student_name',
          type: 'text' as const,
          label: 'اسم الطالب',
          required: true,
        },
        ...rest,
      ]
    })
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)

    const cleanFields = fields
      .map((row) => ({
        ...row,
        label: row.label.trim(),
        id: row.id.trim() || newId(),
      }))
      .filter((row) => row.label.length > 0)

    if (!title.trim()) {
      setErr('أدخل عنوان الواجب.')
      return
    }
    if (!cleanFields.length) {
      setErr('أضف حقلًا واحدًا على الأقل بعنوان واضح.')
      return
    }

    const ids = new Set<string>()
    for (const row of cleanFields) {
      if (ids.has(row.id)) {
        setErr(`المعرف «${row.id}» مكرر. غيّر معرف الحقل.`)
        return
      }
      ids.add(row.id)
    }

    let deadlineAt: string | null = null
    if (deadlineLocal) {
      const d = new Date(deadlineLocal)
      if (Number.isNaN(d.getTime())) {
        setErr('وقت غير صالح.')
        return
      }
      deadlineAt = d.toISOString()
    }

    setBusy(true)
    try {
      const result = await createAssignment({
        title: title.trim(),
        description: description.trim() || undefined,
        deadlineAt,
        fields: cleanFields.map((f) => {
          const base: AssignmentField = {
            id: f.id,
            type: f.type,
            label: f.label,
            required: Boolean(f.required),
          }
          if (f.accept?.trim()) base.accept = f.accept.trim()
          if (f.type !== 'text' && typeof f.maxFiles === 'number')
            base.maxFiles = f.maxFiles
          if (f.type !== 'text' && f.maxFiles == null)
            base.maxFiles = f.type === 'images' ? 10 : 2
          return base
        }),
        shareCode: shareCodeOpt.trim() || null,
      })
      setDone(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setErr(translateCreateError(msg) || msg || 'تعذّر الإنشاء.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const origin = window.location.origin.replace(/\/$/, '')
    const studentUrl = `${origin}/s/${encodeURIComponent(done.shareCode)}`
    const teacherUrl = `${origin}/teacher?aid=${encodeURIComponent(done.id)}`

    const onCopy = (key: string, text: string) => {
      void copyText(text).then((ok) => setCopied(ok ? key : null))
    }

    return (
      <div className="builder-success page-stack">
        <div className="panel success-hero">
          <p className="success-badge">تم ✓</p>
          <h1 className="page-title">تم الإنشاء</h1>
        </div>

        <div className="success-link-grid">
          <section className="section-card panel share-card share-card-student">
            <h2 className="section-card-title">رابط الطالب</h2>
            <code className="share-link-box">{studentUrl}</code>
            <button
              type="button"
              className="btn secondary"
              onClick={() => onCopy('s', studentUrl)}
            >
              {copied === 's' ? 'تم النسخ ✓' : 'نسخ الرابط'}
            </button>
          </section>

          <section className="section-card panel share-card share-card-teacher">
            <h2 className="section-card-title">رابط المراجعة</h2>
            <code className="share-link-box">{teacherUrl}</code>
            <button
              type="button"
              className="btn secondary"
              onClick={() => onCopy('t', teacherUrl)}
            >
              {copied === 't' ? 'تم النسخ ✓' : 'نسخ الرابط'}
            </button>
            <p className="muted small" style={{ marginTop: '0.65rem' }}>
              <strong className="mono-strong" dir="ltr">
                {done.shareCode}
              </strong>
            </p>
          </section>
        </div>

        <div className="form-actions success-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              navigate(`/teacher?aid=${encodeURIComponent(done.id)}`)
            }
          >
            فتح لوحة المراجعة
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => navigate('/teacher/new')}
          >
            إنشاء واجب آخر
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="page-stack builder-page" onSubmit={onSubmit}>
      <div className="panel builder-intro">
        <h1 className="page-title">واجب جديد</h1>
      </div>

      <section className="section-card panel builder-section">
        <h2 className="section-card-title">معلومات الواجب</h2>
        <label className="field">
          <span className="field-label">عنوان الواجب *</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span className="field-label">وصف قصير (اختياري)</span>
        <textarea
          className="input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ resize: 'vertical', minHeight: '4.5rem' }}
        />
      </label>

      <label className="field">
        <span className="field-label">آخر موعد للتسليم (اختياري)</span>
        <input
          className="input"
          type="datetime-local"
          value={deadlineLocal}
          onChange={(e) => setDeadlineLocal(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">كود مشاركة مخصص (اختياري)</span>
        <input
          className="input"
          dir="ltr"
          placeholder="تلقائي"
          value={shareCodeOpt}
          onChange={(e) => setShareCodeOpt(e.target.value.toUpperCase())}
        />
      </label>
      </section>

      <section className="section-card panel builder-section">
        <div className="builder-fields-head">
        <h2 className="section-card-title">حقول الطالب</h2>
        <div className="builder-field-actions">
          <button type="button" className="btn secondary" onClick={insertNamePreset}>
            تعبئة «اسم الطالب»
          </button>
          <button type="button" className="btn secondary" onClick={addField}>
            + حقل
          </button>
        </div>
      </div>

      <ul className="builder-field-list">
        {fields.map((row, index) => (
          <li key={`${row.id}-${index}`} className="builder-field-row panel field-card">
            <div className="field-card-head">
              <span className="field-index">#{index + 1}</span>
              <div className="field-reorder">
                <button
                  type="button"
                  className="btn-icon"
                  title="نقل لأعلى"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  title="نقل لأسفل"
                  disabled={index === fields.length - 1}
                  onClick={() => moveField(index, 1)}
                >
                  ↓
                </button>
              </div>
            </div>
            <div className="builder-field-grid">
              <label className="field">
                <span className="field-label">معرف الحقل (لاتيني)</span>
                <input
                  className="input"
                  dir="ltr"
                  value={row.id}
                  onChange={(e) => patchField(index, { id: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">النوع</span>
                <select
                  className="select"
                  value={row.type}
                  onChange={(e) => {
                    const t = e.target.value as FieldType
                    if (t === 'text') {
                      patchField(index, { type: t, maxFiles: undefined, accept: undefined })
                    } else if (t === 'images') {
                      patchField(index, {
                        type: t,
                        maxFiles: row.maxFiles ?? 10,
                        accept: row.accept ?? 'image/jpeg,image/png,image/webp',
                      })
                    } else {
                      patchField(index, {
                        type: t,
                        maxFiles: row.maxFiles ?? 2,
                        accept: row.accept ?? 'application/pdf',
                      })
                    }
                  }}
                >
                  <option value="text">نص</option>
                  <option value="images">صور</option>
                  <option value="files">ملفات</option>
                </select>
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="field-label">عنوان الحقل للطالب *</span>
                <input
                  className="input"
                  value={row.label}
                  onChange={(e) => patchField(index, { label: e.target.value })}
                />
              </label>
              {row.type !== 'text' ? (
                <>
                  <label className="field">
                    <span className="field-label">أقصى عدد ملفات</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={20}
                      value={row.maxFiles ?? (row.type === 'images' ? 10 : '')}
                      onChange={(e) =>
                        patchField(index, {
                          maxFiles: Number(e.target.value) || undefined,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">أنواع مقبولة (MIME)</span>
                    <input
                      className="input"
                      dir="ltr"
                      placeholder={
                        row.type === 'images'
                          ? 'image/jpeg,image/png'
                          : 'application/pdf'
                      }
                      value={row.accept ?? ''}
                      onChange={(e) => patchField(index, { accept: e.target.value })}
                    />
                  </label>
                </>
              ) : null}
              <label className="field builder-required">
                <input
                  type="checkbox"
                  checked={Boolean(row.required)}
                  onChange={(e) =>
                    patchField(index, { required: e.target.checked })
                  }
                />
                <span>إلزامي</span>
              </label>
            </div>
            <button
              type="button"
              className="btn secondary builder-remove"
              onClick={() => removeField(index)}
            >
              حذف الحقل
            </button>
          </li>
        ))}
      </ul>
      </section>

      {err ? <p className="form-error panel subtle-error">{err}</p> : null}

      <div className="panel form-footer">
        <div className="form-actions">
        <button type="button" className="btn secondary" onClick={() => navigate('/teacher')}>
          رجوع
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء الواجب'}
        </button>
      </div>
      </div>
    </form>
  )
}

