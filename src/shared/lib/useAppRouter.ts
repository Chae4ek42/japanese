import { useCallback, useEffect, useState } from 'react'
import {
  isKnownPath,
  normalizePath,
  parsePath,
  pathForPage,
  pathForRoute,
  titleForRoute,
  type AppRoute,
} from './routes'
import type { AppPage } from './types'

function readPath(): string {
  return normalizePath(window.location.pathname)
}

export function useAppRouter() {
  const [pathname, setPathname] = useState(readPath)

  const syncFromLocation = useCallback(() => {
    setPathname(readPath())
  }, [])

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const next = normalizePath(to)
    const current = readPath()
    if (next === current) {
      setPathname(next)
      return
    }
    if (options?.replace) {
      window.history.replaceState(null, '', next)
    } else {
      window.history.pushState(null, '', next)
    }
    setPathname(next)
  }, [])

  const go = useCallback(
    (route: AppRoute, options?: { replace?: boolean }) => {
      navigate(pathForRoute(route), options)
    },
    [navigate],
  )

  const goPage = useCallback(
    (page: AppPage, options?: { replace?: boolean }) => {
      navigate(pathForPage(page), options)
    },
    [navigate],
  )

  useEffect(() => {
    window.addEventListener('popstate', syncFromLocation)
    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [syncFromLocation])

  useEffect(() => {
    if (pathname === '/vocab/train') {
      navigate(pathForRoute({ page: 'train' }), { replace: true })
      return
    }
    if (pathname === '/vocab/mine') {
      navigate(pathForRoute({ page: 'mine' }), { replace: true })
      return
    }
    if (!isKnownPath(pathname)) {
      navigate(pathForRoute({ page: 'home' }), { replace: true })
    }
  }, [navigate, pathname])

  const route = parsePath(pathname)

  useEffect(() => {
    document.title = titleForRoute(route)
  }, [route])

  return {
    pathname,
    route,
    page: route.page,
    navigate,
    go,
    goPage,
  }
}
