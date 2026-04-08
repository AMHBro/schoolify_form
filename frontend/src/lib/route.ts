export type AppRoute =
  | { name: 'student'; shareCode: string }
  | { name: 'teacher' }
  | { name: 'teacherNew' }
  | { name: 'home' }

export function parsePath(pathname: string): AppRoute {
  const t = pathname.replace(/\/+$/, '') || '/'
  if (t === '/teacher/new' || t.endsWith('/teacher/new')) return { name: 'teacherNew' }
  if (t === '/teacher' || t.endsWith('/teacher')) return { name: 'teacher' }

  const m = t.match(/\/s\/([^/]+)\/?$/)
  if (m) return { name: 'student', shareCode: decodeURIComponent(m[1]) }

  return { name: 'home' }
}
