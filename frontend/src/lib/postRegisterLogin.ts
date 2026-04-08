/** بعد حفظ معلّم من لوحة الإدارة: مزامنة مع الصفحة الرئيسية لمحاولة دخول تلقائية */

const KEY = 'schoolify.postRegisterLogin.v1'

export type PostRegisterLoginPayload = {
  fullName: string
  phone: string
  /** افتراضيًا true: محاولة teacherLogin عند فتح الصفحة الرئيسية */
  autoLogin?: boolean
}

export function setPostRegisterLogin(payload: PostRegisterLoginPayload) {
  try {
    const autoLogin = payload.autoLogin !== false
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        fullName: payload.fullName.trim(),
        phone: payload.phone.trim(),
        ...(autoLogin ? {} : { autoLogin: false }),
      })
    )
  } catch {
    /* ignore */
  }
}

/** يقرأ المرة الأولى ويمسح المفتاح حتى لا يتكرر في React Strict Mode */
export function consumePostRegisterLogin(): PostRegisterLoginPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return null
    const fullName = String((o as PostRegisterLoginPayload).fullName ?? '').trim()
    const phone = String((o as PostRegisterLoginPayload).phone ?? '').trim()
    if (fullName.length < 2 || phone.length < 8) return null
    const autoLogin =
      typeof (o as PostRegisterLoginPayload).autoLogin === 'boolean'
        ? (o as PostRegisterLoginPayload).autoLogin
        : true
    return { fullName, phone, autoLogin }
  } catch {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      /* noop */
    }
    return null
  }
}
