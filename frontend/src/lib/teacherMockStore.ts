/** تخزين محلي لمعلّمين وجلساتهم عند عدم ربط Supabase */

import type { TeacherSession } from './teacherSession'
import { setTeacherSession } from './teacherSession'

const TEACHERS_KEY = 'schoolify.mockTeachers.v1'

type MockTeacherRow = {
  id: string
  fullName: string
  phone: string
}

function normPhone(raw: string): string {
  return raw.replace(/\D/g, '')
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

export function mockRegisterTeacher(
  fullName: string,
  phone: string
): { ok: true } | { ok: false; code: string } {
  const name = fullName.trim()
  const p = normPhone(phone)
  if (name.length < 2) return { ok: false, code: 'name_required' }
  if (p.length < 8) return { ok: false, code: 'phone_invalid' }

  const all = readTeachers()
  if (all.some((t) => t.phone === p)) return { ok: false, code: 'phone_taken' }

  const row: MockTeacherRow = {
    id: crypto.randomUUID(),
    fullName: name,
    phone: p,
  }
  all.push(row)
  writeTeachers(all)
  return { ok: true }
}

export function mockLoginTeacher(
  fullName: string,
  phone: string
): TeacherSession | { error: string } {
  const name = fullName.trim()
  const p = normPhone(phone)
  if (name.length < 2 || p.length < 8) return { error: 'invalid_credentials' }

  const t = readTeachers().find(
    (row) =>
      row.phone === p && row.fullName.trim().toLowerCase() === name.toLowerCase()
  )
  if (!t) return { error: 'invalid_credentials' }

  const session: TeacherSession = {
    token: crypto.randomUUID(),
    teacherId: t.id,
    fullName: t.fullName,
  }
  setTeacherSession(session)
  return session
}
