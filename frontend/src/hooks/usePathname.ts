import { useCallback, useEffect, useState } from 'react'

type Loc = { pathname: string; search: string }

function readLoc(): Loc {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  }
}

export function usePathname() {
  const [loc, setLoc] = useState<Loc>(() => readLoc())

  useEffect(() => {
    const sync = () => setLoc(readLoc())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const navigate = useCallback((path: string) => {
    const u = new URL(path, window.location.origin)
    const next = u.pathname + u.search + u.hash
    window.history.pushState({}, '', next)
    setLoc(readLoc())
  }, [])

  return { pathname: loc.pathname, search: loc.search, navigate }
}
