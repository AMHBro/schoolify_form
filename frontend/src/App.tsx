import type { ReactNode } from 'react'
import './App.css'
import { AppHeader } from './components/AppHeader'
import { parsePath } from './lib/route'
import { usePathname } from './hooks/usePathname'
import { AssignmentBuilderPage } from './views/AssignmentBuilderPage'
import { HomePage } from './views/HomePage'
import { StudentAssignmentPage } from './views/StudentAssignmentPage'
import { TeacherDashboard } from './views/TeacherDashboard'

function App() {
  const { pathname, search, navigate } = usePathname()
  const route = parsePath(pathname)

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

  const wideLayout = route.name !== 'home'

  return (
    <div className="app-shell">
      <AppHeader pathname={pathname} navigate={navigate} />
      <main className={`main${wideLayout ? ' main-wide' : ''}`}>{body}</main>
    </div>
  )
}

export default App
