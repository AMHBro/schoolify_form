import { getPageContext } from '../lib/pageContext'
import { clearTeacherSession, getTeacherSession } from '../lib/teacherSession'

type Props = {
  pathname: string
  navigate: (path: string) => void
}

export function AppHeader({ pathname, navigate }: Props) {
  const { kicker, label } = getPageContext(pathname)
  const pathNorm = pathname.replace(/\/+$/, '') || '/'
  const isTeacherBoard = pathNorm === '/teacher'
  const isTeacherNew = pathNorm === '/teacher/new'
  const loggedIn = !!getTeacherSession()

  const brandTarget = loggedIn ? '/teacher' : '/'

  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <button
          type="button"
          className="brand"
          onClick={() => navigate(brandTarget)}
        >
          Schoolify
        </button>
        <span className="context-chip" aria-hidden="true">
          <span className="context-kicker">{kicker}</span>
          <span className="context-sep" />
          <span className="context-label">{label}</span>
        </span>
      </div>
      <nav className="top-nav" aria-label="التنقل الرئيسي">
        {loggedIn ? (
          <>
            <div className="nav-cluster" role="group" aria-label="الأستاذ">
              <button
                type="button"
                className={`nav-pill ${isTeacherBoard ? 'is-active' : ''}`}
                onClick={() => navigate('/teacher')}
              >
                الواجبات
              </button>
              <button
                type="button"
                className={`nav-pill nav-pill-primary ${isTeacherNew ? 'is-active' : ''}`}
                onClick={() => navigate('/teacher/new')}
              >
                إنشاء واجب
              </button>
            </div>
            <div className="nav-cluster" role="group">
              <button
                type="button"
                className="nav-pill nav-pill-ghost"
                onClick={() => {
                  clearTeacherSession()
                  navigate('/')
                }}
              >
                خروج
              </button>
            </div>
          </>
        ) : (
          <div className="nav-cluster" role="group">
            <span className="muted small" style={{ paddingInline: '0.35rem' }}>
              للأساتذة — سجّل الدخول من الصفحة الرئيسية
            </span>
          </div>
        )}
      </nav>
    </header>
  )
}
