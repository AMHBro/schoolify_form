import type { ReactNode } from 'react'
import { useEffect } from 'react'
import './App.css'
import { AppHeader } from './components/AppHeader'
import { parsePath } from './lib/route'
import { usePathname } from './hooks/usePathname'
import { getTeacherSession } from './lib/teacherSession'
import { AssignmentBuilderPage } from './views/AssignmentBuilderPage'
import { HomePage } from './views/HomePage'
import { StudentAssignmentPage } from './views/StudentAssignmentPage'
import { TeacherDashboard } from './views/TeacherDashboard'

function App() {
  const { pathname, search, navigate } = usePathname()
  const route = parsePath(pathname)
  const isStudent = route.name === 'student'

  useEffect(() => {
    const r = parsePath(pathname)
    if (r.name === 'home' && getTeacherSession()) {
      navigate('/teacher')
      return
    }
    if (r.name === 'teacherNew' && !getTeacherSession()) {
      navigate('/')
      return
    }
    if (r.name === 'teacher') {
      const q = new URLSearchParams(search)
      const legacy = !!(q.get('aid')?.trim() && q.get('tv')?.trim())
      if (!legacy && !getTeacherSession()) navigate('/')
    }
  }, [pathname, search, navigate])

  let body: ReactNode
  if (route.name === 'teacherNew')
    body = <AssignmentBuilderPage navigate={navigate} />
  else if (route.name === 'teacher')
    body = (
      <TeacherDashboard
        key={`${pathname}${search}`}
        navigate={navigate}
        search={search}
      />
    )
  else if (route.name === 'student')
    body = <StudentAssignmentPage shareCode={route.shareCode} />
  else body = <HomePage go={navigate} />

  const mainClass =
    'main' +
    (route.name !== 'home' ? ' main-wide' : '') +
    (isStudent ? ' main--student' : '')

  return (
    <div className={`app-shell${isStudent ? ' app-shell--student' : ''}`}>
      {!isStudent ? <AppHeader pathname={pathname} navigate={navigate} /> : null}
      <main className={mainClass}>{body}</main>
    </div>
  )
}

export default App
