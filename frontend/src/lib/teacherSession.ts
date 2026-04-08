const KEY = 'schoolify.teacherSession.v1'

export type TeacherSession = {
  token: string
  teacherId: string
  fullName: string
}

export function getTeacherSession(): TeacherSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<TeacherSession>
    if (
      typeof p.token === 'string' &&
      typeof p.teacherId === 'string' &&
      typeof p.fullName === 'string'
    ) {
      return { token: p.token, teacherId: p.teacherId, fullName: p.fullName }
    }
    return null
  } catch {
    return null
  }
}

export function setTeacherSession(s: TeacherSession) {
  sessionStorage.setItem(KEY, JSON.stringify(s))
}

export function clearTeacherSession() {
  sessionStorage.removeItem(KEY)
}

export function requireTeacherSession(): TeacherSession | null {
  return getTeacherSession()
}
