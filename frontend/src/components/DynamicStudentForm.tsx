import { useCallback, useMemo, useState } from 'react'
import type {
  AssignmentSchema,
  AssignmentField,
  UploadedAssetPreview,
} from '../types/assignment'
import { submitAssignment } from '../lib/assignmentApi'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function revokeList(list: UploadedAssetPreview[]) {
  list.forEach((a) => URL.revokeObjectURL(a.previewUrl))
}

function isDeadlinePassed(deadlineIso?: string) {
  if (!deadlineIso) return false
  return Date.now() > new Date(deadlineIso).getTime()
}

function acceptForField(f: AssignmentField): string {
  if (f.accept) return f.accept
  if (f.type === 'images') {
    return 'image/*,image/jpeg,image/png,image/webp,image/heic,image/heif'
  }
  return '*'
}

function maxFilesForField(f: AssignmentField): number {
  const raw = f.maxFiles
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.min(20, Math.floor(raw))
  }
  return f.type === 'images' ? 10 : 2
}

type Props = {
  schema: AssignmentSchema
}

export function DynamicStudentForm({ schema }: Props) {
  const closed = isDeadlinePassed(schema.deadlineAt)
  const [textValues, setTextValues] = useState<Record<string, string>>({})
  const [filesByField, setFilesByField] = useState<
    Record<string, UploadedAssetPreview[]>
  >({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = useMemo(() => {
    const m = new Map<string, AssignmentField>()
    schema.fields.forEach((f) => m.set(f.id, f))
    return m
  }, [schema.fields])

  const setFilesForField = useCallback(
    (fieldId: string, next: UploadedAssetPreview[]) => {
      setFilesByField((prev) => {
        const old = prev[fieldId]
        if (old) revokeList(old)
        return { ...prev, [fieldId]: next }
      })
    },
    []
  )

  const onPickFiles = useCallback(
    (field: AssignmentField, list: FileList | null) => {
      if (!list?.length) return
      const max = maxFilesForField(field)
      const existing = filesByField[field.id] ?? []
      const incoming = [...list]
      const merged: File[] = [...existing.map((e) => e.file), ...incoming].slice(
        0,
        max
      )
      const previews: UploadedAssetPreview[] = merged.map((file) => {
        const isImage = file.type.startsWith('image/')
        return {
          id: uid(),
          file,
          previewUrl: isImage ? URL.createObjectURL(file) : '',
          isImage,
        }
      })
      setFilesForField(field.id, previews)
    },
    [filesByField, setFilesForField]
  )

  const removePreview = useCallback(
    (fieldId: string, assetId: string) => {
      const field = byId.get(fieldId)
      if (!field) return
      const cur = filesByField[fieldId] ?? []
      const next = cur.filter((a) => {
        if (a.id === assetId) {
          if (a.isImage) URL.revokeObjectURL(a.previewUrl)
          return false
        }
        return true
      })
      setFilesForField(fieldId, next)
    },
    [byId, filesByField, setFilesForField]
  )

  const validate = useCallback(() => {
    for (const f of schema.fields) {
      if (f.type === 'text') {
        if (f.required && !(textValues[f.id]?.trim()))
          return `الحقل «${f.label}» مطلوب.`
      } else {
        const n = (filesByField[f.id] ?? []).length
        if (f.required && n === 0) return `الحقل «${f.label}» مطلوب.`
      }
    }
    return null
  }, [filesByField, schema.fields, textValues])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setBusy(true)
    const fd = new FormData()
    fd.append('assignment_id', schema.id)
    for (const f of schema.fields) {
      if (f.type === 'text') {
        fd.append(f.id, textValues[f.id] ?? '')
      } else {
        ;(filesByField[f.id] ?? []).forEach((a, i) => {
          fd.append(`${f.id}[]`, a.file, a.file.name)
          fd.append(`${f.id}_meta[${i}]`, JSON.stringify({ id: a.id }))
        })
      }
    }
    const r = await submitAssignment(schema.shareCode, fd)
    setBusy(false)
    if (!r.ok) {
      setError(r.message ?? 'تعذّر الإرسال.')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="panel success-panel student-shell">
        <h2 className="success-title">تم الإرسال</h2>
      </div>
    )
  }

  if (closed) {
    return (
      <div className="panel closed-panel student-shell">
        <h2>انتهى موعد التسليم</h2>
      </div>
    )
  }

  return (
    <form className="panel student-form student-shell" onSubmit={onSubmit}>
      <header className="form-head">
        <h1 className="form-title">{schema.title}</h1>
        {schema.description && (
          <p className="muted">{schema.description}</p>
        )}
        {schema.deadlineAt && (
          <p className="deadline">
            آخر موعد:{' '}
            <time dateTime={schema.deadlineAt}>
              {new Date(schema.deadlineAt).toLocaleString('ar-SA', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </time>
          </p>
        )}
      </header>

      <div className="field-stack">
        {schema.fields.map((f) => {
          if (f.type === 'text') {
            return (
              <label key={f.id} className="field">
                <span className="field-label">
                  {f.label}
                  {f.required ? <span className="req"> *</span> : null}
                </span>
                <input
                  className="input"
                  type="text"
                  value={textValues[f.id] ?? ''}
                  onChange={(e) =>
                    setTextValues((s) => ({ ...s, [f.id]: e.target.value }))
                  }
                  required={f.required}
                  autoComplete="name"
                />
              </label>
            )
          }

          const previews = filesByField[f.id] ?? []
          const accept = acceptForField(f)
          const maxCount = maxFilesForField(f)
          return (
            <div key={f.id} className="field">
              <span className="field-label">
                {f.label}
                {f.required ? <span className="req"> *</span> : null}
              </span>
              <label className="upload-zone">
                <input
                  type="file"
                  className="visually-hidden"
                  accept={accept}
                  multiple={f.type === 'images'}
                  onChange={(e) => onPickFiles(f, e.target.files)}
                />
                <span className="upload-hint">
                  {f.type === 'images'
                    ? `صور — حتى ${maxCount}`
                    : `ملفات — حتى ${maxCount}`}
                </span>
              </label>
              {previews.length > 0 && (
                <ul className="thumb-grid">
                  {previews.map((a) => (
                    <li key={a.id} className="thumb-item">
                      {a.isImage ? (
                        <img
                          src={a.previewUrl}
                          alt=""
                          className="thumb-img"
                        />
                      ) : (
                        <div className="thumb-file">{a.file.name}</div>
                      )}
                      <button
                        type="button"
                        className="thumb-remove"
                        onClick={() => removePreview(f.id, a.id)}
                      >
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'جارٍ الإرسال…' : 'إرسال'}
        </button>
      </div>
    </form>
  )
}
