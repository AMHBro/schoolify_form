import { useEffect, useState } from 'react'
import { DynamicStudentForm } from '../components/DynamicStudentForm'
import type { AssignmentSchema } from '../types/assignment'
import { fetchAssignmentByCode } from '../lib/assignmentApi'

type Props = { shareCode: string }

export function StudentAssignmentPage({ shareCode }: Props) {
  const [schema, setSchema] = useState<AssignmentSchema | null | undefined>(
    undefined
  )

  useEffect(() => {
    let on = true
    ;(async () => {
      const a = await fetchAssignmentByCode(shareCode)
      if (on) setSchema(a)
    })()
    return () => {
      on = false
    }
  }, [shareCode])

  if (schema === undefined) {
    return (
      <div className="page-stack">
        <div className="panel student-shell">
          <p className="muted">جارٍ تحميل الواجب…</p>
        </div>
      </div>
    )
  }

  if (schema === null) {
    const codeInUrl = shareCode.trim() || '—'
    return (
      <div className="page-stack">
        <div className="panel closed-panel student-shell">
          <h2>الواجب غير متوفر</h2>
          <p className="muted">
            <code className="inline-code" dir="ltr">
              {codeInUrl}
            </code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <DynamicStudentForm schema={schema} />
    </div>
  )
}
