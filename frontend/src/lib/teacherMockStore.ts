/** تخزين محلي لمعلّمين وجلساتهم عند عدم ربط Supabase */

import type { TeacherSession } from './teacherSession'
import { mockDetachTeacherFromAssignments } from './localAssignmentStore'
import { normalizeTeacherName, normalizeTeacherPhone } from './phoneNormalize'
import { setTeacherSession } from './teacherSession'

const TEACHERS_KEY = 'schoolify.mockTeachers.v1'

type MockTeacherRow = {
  id: string
  fullName: string
  phone: string
}

function readTeachers(): MockTeacherRow[] {
  try {
    const raw = localStorage.getItem(TEACHERS_KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    return Array.isArray(p) ? (p as MockTeacherRow[]) : []
  } catch {
    return []
  }
}

function writeTeachers(rows: MockTeacherRow[]) {
  localStorage.setItem(TEACHERS_KEY, JSON.stringify(rows))
}

/** بذرة معلّم للوضع المحلي بدون Supabase */
const DEMO_TEACHER_ID = 'c0e8400e-d29f-41d4-a716-446655440001'

export function ensureMockDemoTeacher() {
  const all = readTeachers()
  if (all.some((t) => t.id === DEMO_TEACHER_ID)) return
  if (all.some((t) => t.phone === '966500000000')) return
  all.push({
    id: DEMO_TEACHER_ID,
    fullName: 'معلّم تجريبي',
    phone: '966500000000',
  })
  writeTeachers(all)
}

export function mockRegisterTeacher(
  fullName: string,
  phone: string
): { ok: true } | { ok: false; code: string } {
  const name = normalizeTeacherName(fullName)
  const p = normalizeTeacherPhone(phone)
  if (name.length < 2) return { ok: false, code: 'name_required' }
  if (p.length < 8) return { ok: false, code: 'phone_invalid' }

  const all = readTeachers()
  if (all.some((t) => normalizeTeacherPhone(t.phone) === p))
    return { ok: false, code: 'phone_taken' }

  const row: MockTeacherRow = {
    id: crypto.randomUUID(),
    fullName: name,
    phone: p,
  }
  all.push(row)
  writeTeachers(all)
  return { ok: true }
}

export function mockListTeachers(): MockTeacherRow[] {
  return readTeachers().slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'))
}

export function mockDeleteTeacher(teacherId: string): boolean {
  const all = readTeachers()
  const next = all.filter((t) => t.id !== teacherId)
  if (next.length === all.length) return false
  writeTeachers(next)
  mockDetachTeacherFromAssignments(teacherId)
  return true
}

export function mockLoginTeacher(
  fullName: string,
  phone: string
): TeacherSession | { error: string } {
  const name = normalizeTeacherName(fullName)
  const p = normalizeTeacherPhone(phone)
  if (name.length < 2 || p.length < 8) return { error: 'invalid_credentials' }

  const all = readTeachers()
  let t = all.find(
    (row) =>
      normalizeTeacherPhone(row.phone) === p &&
      normalizeTeacherName(row.fullName).toLowerCase() === name.toLowerCase()
  )
  if (!t) {
    const byPhone = all.filter((row) => normalizeTeacherPhone(row.phone) === p)
    if (byPhone.length === 1) t = byPhone[0]
  }
  if (!t) return { error: 'invalid_credentials' }

  const session: TeacherSession = {
    token: crypto.randomUUID(),
    teacherId: t.id,
    fullName: t.fullName,
  }
  setTeacherSession(session)
  return session
}
