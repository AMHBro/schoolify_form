import { allowStudentDemo } from '../lib/featureFlags'

type Props = { go: (path: string) => void }

export function HomePage({ go }: Props) {
  const showDemo = allowStudentDemo()

  return (
    <div className="home-wrap">
      <header className="home-hero panel">
        <p className="home-eyebrow">Schoolify</p>
        <h1 className="home-title">تسليم الواجبات بشكل واضح ومنظم</h1>
        <p className="home-lead muted">
          يحدّد الأستاذ ما يطلبه من الطالب، يشارك رابطًا واحدًا، ويراجع التسليمات
          في لوحة واحدة — دون فوضى المحادثات.
        </p>
      </header>

      <ol className="step-tracker" aria-label="خطوات العمل">
        <li className="step-tracker-item">
          <span className="step-num">1</span>
          <div>
            <strong>إنشاء النموذج</strong>
            <p className="muted">عنوان، موعد، حقول نص أو صور أو ملفات.</p>
          </div>
        </li>
        <li className="step-tracker-item">
          <span className="step-num">2</span>
          <div>
            <strong>مشاركة الرابط</strong>
            <p className="muted">الطلاب يفتحون الرابط فقط — لا يدخلون من الصفحة الرئيسية.</p>
          </div>
        </li>
        <li className="step-tracker-item">
          <span className="step-num">3</span>
          <div>
            <strong>المتابعة</strong>
            <p className="muted">فرز التسليمات، معاينة، وتصدير عند الحاجة.</p>
          </div>
        </li>
      </ol>

      <div className="home-split">
        <section className="section-card panel">
          <h2 className="section-card-title">للطلاب</h2>
          <p className="muted section-card-desc">
            يصلكم <strong>رابط التسليم</strong> من الأستاذ بعد تجهيز الواجب. لا يوجد
            تقديم من هذه الصفحة.
          </p>
        </section>
        <section className="section-card panel section-card-accent">
          <h2 className="section-card-title">للأساتذة</h2>
          <p className="muted section-card-desc">
            ابدأ من إنشاء واجب جديد، أو افتح لوحة مراجعة لواجب أعدته مسبقًا.
          </p>
          <ul className="home-actions">
            <li>
              <button
                type="button"
                className="btn primary"
                onClick={() => go('/teacher/new')}
              >
                إنشاء واجب ورابط للطلاب
              </button>
            </li>
            <li>
              <button
                type="button"
                className="btn secondary"
                onClick={() => go('/teacher')}
              >
                لوحة المراجعة
              </button>
            </li>
            {showDemo ? (
              <li>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => go('/s/DEMO2024')}
                >
                  تجربة محلية (DEMO2024)
                </button>
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      {showDemo ? (
        <p className="muted home-demo-note">
          زر التجربة يظهر عند{' '}
          <code className="inline-code">VITE_ALLOW_STUDENT_DEMO=true</code>.
        </p>
      ) : null}
    </div>
  )
}
