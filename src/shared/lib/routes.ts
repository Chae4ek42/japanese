import type { AppPage } from './types'

export type AppRoute = { page: AppPage }

export const PATHS = {
  home: '/',
  kana: '/kana',
  kanji: '/kanji',
  numbers: '/numbers',
  particles: '/particles',
  reader: '/reader',
  vocab: '/vocab',
  mine: '/mine',
  /** @deprecated Use PATHS.mine — kept for redirects/bookmarks. */
  vocabMine: '/vocab/mine',
  /** @deprecated Use PATHS.train — kept for redirects/bookmarks. */
  vocabTrain: '/vocab/train',
  train: '/train',
  theory: '/theory',
  analytics: '/analytics',
  accounts: '/accounts',
} as const

const PAGE_TITLES: Record<AppPage, string> = {
  home: 'JP тренажёры',
  kana: 'Кана — JP тренажёры',
  kanji: 'Кандзи — JP тренажёры',
  numbers: 'Числа — JP тренажёры',
  particles: 'Частицы — JP тренажёры',
  reader: 'Текст — JP тренажёры',
  vocab: 'Словарь — JP тренажёры',
  mine: 'Мои слова — JP тренажёры',
  train: 'Слова — JP тренажёры',
  theory: 'Теория — JP тренажёры',
  analytics: 'Аналитика — JP тренажёры',
  accounts: 'Аккаунты — JP тренажёры',
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
    case PATHS.particles:
      return { page: 'particles' }
    case PATHS.reader:
      return { page: 'reader' }
    case PATHS.vocab:
      return { page: 'vocab' }
    case PATHS.vocabMine:
    case PATHS.mine:
      return { page: 'mine' }
    case PATHS.vocabTrain:
    case PATHS.train:
      return { page: 'train' }
    case PATHS.theory:
      return { page: 'theory' }
    case PATHS.analytics:
      return { page: 'analytics' }
    case PATHS.accounts:
      return { page: 'accounts' }
    default:
      return { page: 'home' }
  }
}

export function pathForRoute(route: AppRoute): string {
  return PATHS[route.page]
}

export function pathForPage(page: AppPage): string {
  return pathForRoute({ page })
}

export function isKnownPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return (
    path === PATHS.home ||
    path === PATHS.kana ||
    path === PATHS.kanji ||
    path === PATHS.numbers ||
    path === PATHS.particles ||
    path === PATHS.reader ||
    path === PATHS.vocab ||
    path === PATHS.mine ||
    path === PATHS.vocabMine ||
    path === PATHS.vocabTrain ||
    path === PATHS.train ||
    path === PATHS.theory ||
    path === PATHS.analytics ||
    path === PATHS.accounts
  )
}

export function titleForRoute(route: AppRoute): string {
  return PAGE_TITLES[route.page]
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
