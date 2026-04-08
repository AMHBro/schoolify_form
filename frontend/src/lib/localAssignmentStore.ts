import type {
  AssignmentField,
  AssignmentSchema,
  SubmissionRecord,
} from '../types/assignment'

const KEY = 'schoolify.assignments.v1'

export type StoredAssignment = {
  id: string
  teacherId?: string
  teacherViewToken: string
  shareCode: string
  title: string
  description?: string
  deadlineAt?: string
  createdAt?: string
  fields: AssignmentField[]
  submissions: SubmissionRecord[]
}

function readAll(): StoredAssignment[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    return Array.isArray(p) ? (p as StoredAssignment[]) : []
  } catch {
    return []
  }
}

function writeAll(rows: StoredAssignment[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
}

export function mockListAssignments(): StoredAssignment[] {
  return readAll()
}

export function mockCreateAssignment(row: Omit<StoredAssignment, 'submissions'>): void {
  const all = readAll()
  all.push({ ...row, submissions: [] })
  writeAll(all)
}

export function mockFindByShareCode(shareCode: string): StoredAssignment | null {
  const c = shareCode.trim().toUpperCase()
  return readAll().find((a) => a.shareCode.toUpperCase() === c) ?? null
}

export function mockFindByIdAndToken(
  id: string,
  token: string
): StoredAssignment | null {
  return (
    readAll().find((a) => a.id === id && a.teacherViewToken === token) ?? null
  )
}

export function mockFindByIdForTeacher(
  id: string,
  teacherId: string
): StoredAssignment | null {
  return (
    readAll().find((a) => a.id === id && a.teacherId === teacherId) ?? null
  )
}

export function mockListForTeacher(teacherId: string): StoredAssignment[] {
  return readAll().filter((a) => a.teacherId === teacherId)
}

export function toSchema(a: StoredAssignment): AssignmentSchema {
  const code = a.shareCode.trim().toUpperCase()
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    deadlineAt: a.deadlineAt,
    shareCode: code,
    publicUrl: `/s/${encodeURIComponent(code)}`,
    fields: a.fields,
  }
}

export function mockAppendSubmission(
  shareCode: string,
  submission: SubmissionRecord
): void {
  const all = readAll()
  const i = all.findIndex(
    (a) => a.shareCode.toUpperCase() === shareCode.trim().toUpperCase()
  )
  if (i < 0) return
  all[i]!.submissions.push(submission)
  writeAll(all)
}

export function mockGenerateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  if (readAll().some((a) => a.shareCode === out)) return mockGenerateShareCode()
  return out
}

export function mockDeleteAssignment(assignmentId: string): boolean {
  const all = readAll()
  const next = all.filter((a) => a.id !== assignmentId)
  if (next.length === all.length) return false
  writeAll(next)
  return true
}

/** يطابق سلوك FK on delete set null في Supabase */
export function mockDetachTeacherFromAssignments(teacherId: string): void {
  const all = readAll()
  if (!all.some((a) => a.teacherId === teacherId)) return
  writeAll(
    all.map((a) =>
      a.teacherId === teacherId ? { ...a, teacherId: undefined } : a
    )
  )
}
