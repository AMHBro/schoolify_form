import { allowStudentDemo } from '../lib/featureFlags'
import { getPageContext } from '../lib/pageContext'

type Props = {
  pathname: string
  navigate: (path: string) => void
}

export function AppHeader({ pathname, navigate }: Props) {
  const { kicker, label } = getPageContext(pathname)
  const showDemo = allowStudentDemo()
  const pathNorm = pathname.replace(/\/+$/, '') || '/'
  const isHome = pathNorm === '/'
  const isTeacherBoard = pathNorm === '/teacher'
  const isTeacherNew = pathNorm === '/teacher/new'

  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <button type="button" className="brand" onClick={() => navigate('/')}>
          Schoolify
        </button>
        <span className="context-chip" aria-hidden="true">
          <span className="context-kicker">{kicker}</span>
          <span className="context-sep" />
          <span className="context-label">{label}</span>
        </span>
      </div>
      <nav className="top-nav" aria-label="التنقل الرئيسي">
        <div className="nav-cluster" role="group" aria-label="عام">
          <button
            type="button"
            className={`nav-pill ${isHome ? 'is-active' : ''}`}
            onClick={() => navigate('/')}
          >
            الرئيسية
          </button>
        </div>
        <div className="nav-cluster" role="group" aria-label="الأستاذ">
          <button
            type="button"
            className={`nav-pill ${isTeacherBoard ? 'is-active' : ''}`}
            onClick={() => navigate('/teacher')}
          >
            اللوحة
          </button>
          <button
            type="button"
            className={`nav-pill nav-pill-primary ${isTeacherNew ? 'is-active' : ''}`}
            onClick={() => navigate('/teacher/new')}
          >
            إنشاء واجب
          </button>
        </div>
        {showDemo ? (
          <div className="nav-cluster" role="group" aria-label="تجربة">
            <button
              type="button"
              className="nav-pill nav-pill-ghost"
              onClick={() => navigate('/s/DEMO2024')}
            >
              تجربة طالب
            </button>
          </div>
        ) : null}
      </nav>
    </header>
  )
}
