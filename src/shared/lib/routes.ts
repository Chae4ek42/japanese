import type { AppPage } from './types'

export type VocabRouteSection = 'catalog' | 'train' | 'mine'

export type AppRoute =
  | { page: Exclude<AppPage, 'vocab'> }
  | { page: 'vocab'; section: VocabRouteSection }

export const PATHS = {
  home: '/',
  kana: '/kana',
  kanji: '/kanji',
  numbers: '/numbers',
  vocab: '/vocab',
  vocabTrain: '/vocab/train',
  vocabMine: '/vocab/mine',
} as const

const PAGE_TITLES: Record<AppPage, string> = {
  home: 'JP тренажёры',
  kana: 'Кана — JP тренажёры',
  kanji: 'Кандзи — JP тренажёры',
  numbers: 'Числа — JP тренажёры',
  vocab: 'Словарь — JP тренажёры',
}

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/'
  }
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function parsePath(pathname: string): AppRoute {
  const path = normalizePath(pathname)
  switch (path) {
    case PATHS.home:
      return { page: 'home' }
    case PATHS.kana:
      return { page: 'kana' }
    case PATHS.kanji:
      return { page: 'kanji' }
    case PATHS.numbers:
      return { page: 'numbers' }
    case PATHS.vocab:
      return { page: 'vocab', section: 'catalog' }
    case PATHS.vocabTrain:
      return { page: 'vocab', section: 'train' }
    case PATHS.vocabMine:
      return { page: 'vocab', section: 'mine' }
    default:
      return { page: 'home' }
  }
}

export function pathForRoute(route: AppRoute): string {
  if (route.page === 'vocab') {
    if (route.section === 'train') {
      return PATHS.vocabTrain
    }
    if (route.section === 'mine') {
      return PATHS.vocabMine
    }
    return PATHS.vocab
  }
  return PATHS[route.page]
}

export function pathForPage(page: AppPage, vocabSection: VocabRouteSection = 'catalog'): string {
  if (page === 'vocab') {
    return pathForRoute({ page: 'vocab', section: vocabSection })
  }
  return pathForRoute({ page })
}

export function isKnownPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return (
    path === PATHS.home ||
    path === PATHS.kana ||
    path === PATHS.kanji ||
    path === PATHS.numbers ||
    path === PATHS.vocab ||
    path === PATHS.vocabTrain ||
    path === PATHS.vocabMine
  )
}

export function titleForRoute(route: AppRoute): string {
  return PAGE_TITLES[route.page]
}

/** Left-click without modifier keys → client-side navigation. */
export function shouldHandleClientNav(event: { button?: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return (
    (event.button === undefined || event.button === 0) &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}
