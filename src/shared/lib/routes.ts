import type { AppPage } from './types'
import { isKnownPagePath, pageFromPath, pathForPage as pathForPageId, titleForPage } from './pages'

export type AppRoute = { page: AppPage }

export { PATHS } from './pages'

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/'
  }
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function parsePath(pathname: string): AppRoute {
  return { page: pageFromPath(normalizePath(pathname)) ?? 'home' }
}

export function pathForRoute(route: AppRoute): string {
  return pathForPageId(route.page)
}

export function pathForPage(page: AppPage): string {
  return pathForPageId(page)
}

export function isKnownPath(pathname: string): boolean {
  return isKnownPagePath(normalizePath(pathname))
}

export function titleForRoute(route: AppRoute): string {
  return titleForPage(route.page)
}

/** Left-click without modifier keys → client-side navigation. */
export function shouldHandleClientNav(event: {
  button?: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): boolean {
  return (
    (event.button === undefined || event.button === 0) &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}
