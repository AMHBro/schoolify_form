const KEY = 'schoolify.systemAdminSecret.v1'

export function getSystemAdminSecret(): string | null {
  try {
    const v = sessionStorage.getItem(KEY)?.trim()
    return v || null
  } catch {
    return null
  }
}

export function setSystemAdminSecret(secret: string) {
  try {
    sessionStorage.setItem(KEY, secret.trim())
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
