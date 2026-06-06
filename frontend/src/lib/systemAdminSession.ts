const KEY = 'schoolify.systemAdminSecret.v1'

/** إزالة مسافات غير منكسرة وأحرف اتجاه/عرض خفيّة قد تُلصق من المحرّر أو الواتساب */
export function normalizeSystemAdminSecretInput(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
}

export function getSystemAdminSecret(): string | null {
  try {
    const v = sessionStorage.getItem(KEY)
    const n = v ? normalizeSystemAdminSecretInput(v) : ''
    return n || null
  } catch {
    return null
  }
}

export function setSystemAdminSecret(secret: string) {
  try {
    sessionStorage.setItem(KEY, normalizeSystemAdminSecretInput(secret))
  } catch {
    /* ignore */
  }
}

export function clearSystemAdminSecret() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
