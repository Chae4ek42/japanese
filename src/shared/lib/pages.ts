import type { AppPage } from './types'

export type NavGroup = 'primary' | 'none'
export type HomeGroup = 'practice' | 'reference'

export interface HomeEntryMeta {
  symbol: string
  title: string
  action: string
  testId: string
  group: HomeGroup
  hint?: string
}

export interface PageMeta {
  id: AppPage
  path: string
  documentTitle: string
  navLabel: string
  navTestId: string
  navGroup: NavGroup
  /** Wrap in `.trainer-layout` (kana / numbers / particles). */
  trainerLayout?: boolean
  home?: HomeEntryMeta
}

export const PATHS = {
  home: '/',
  kana: '/kana',
  kanji: '/kanji',
  numbers: '/numbers',
  particles: '/particles',
  verbs: '/verbs',
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

/** Extra path aliases that still parse to a page. */
export const PATH_ALIASES: Record<string, AppPage> = {
  [PATHS.vocabMine]: 'mine',
  [PATHS.vocabTrain]: 'train',
}

export const PAGE_META: PageMeta[] = [
  {
    id: 'home',
    path: PATHS.home,
    documentTitle: 'JP тренажёры',
    navLabel: 'Главная',
    navTestId: 'nav-main',
    navGroup: 'primary',
  },
  {
    id: 'kana',
    path: PATHS.kana,
    documentTitle: 'Кана — JP тренажёры',
    navLabel: 'Кана',
    navTestId: 'nav-kana',
    navGroup: 'primary',
    trainerLayout: true,
    home: {
      symbol: 'あ',
      title: 'Кана',
      action: 'Начать',
      testId: 'open-kana',
      group: 'practice',
    },
  },
  {
    id: 'kanji',
    path: PATHS.kanji,
    documentTitle: 'Кандзи — JP тренажёры',
    navLabel: 'Кандзи',
    navTestId: 'nav-kanji',
    navGroup: 'primary',
    home: {
      symbol: '字',
      title: 'Кандзи',
      action: 'Открыть',
      testId: 'open-kanji',
      group: 'reference',
    },
  },
  {
    id: 'numbers',
    path: PATHS.numbers,
    documentTitle: 'Числа — JP тренажёры',
    navLabel: 'Числа',
    navTestId: 'nav-numbers',
    navGroup: 'primary',
    trainerLayout: true,
    home: {
      symbol: '十',
      title: 'Числа и возраст',
      action: 'Начать',
      testId: 'open-numbers',
      group: 'practice',
    },
  },
  {
    id: 'particles',
    path: PATHS.particles,
    documentTitle: 'Частицы — JP тренажёры',
    navLabel: 'Частицы',
    navTestId: 'nav-particles',
    navGroup: 'primary',
    trainerLayout: true,
    home: {
      symbol: 'は',
      title: 'Частицы',
      action: 'Начать',
      testId: 'open-particles',
      group: 'practice',
    },
  },
  {
    id: 'verbs',
    path: PATHS.verbs,
    documentTitle: 'Глаголы — JP тренажёры',
    navLabel: 'Глаголы',
    navTestId: 'nav-verbs',
    navGroup: 'primary',
    trainerLayout: true,
    home: {
      symbol: '動',
      title: 'Глаголы',
      action: 'Начать',
      testId: 'open-verbs',
      group: 'practice',
    },
  },
  {
    id: 'train',
    path: PATHS.train,
    documentTitle: 'Слова — JP тренажёры',
    navLabel: 'Слова',
    navTestId: 'nav-train',
    navGroup: 'primary',
    home: {
      symbol: '練',
      title: 'Слова',
      action: 'Начать',
      testId: 'open-vocab-train',
      group: 'practice',
    },
  },
  {
    id: 'reader',
    path: PATHS.reader,
    documentTitle: 'Текст — JP тренажёры',
    navLabel: 'Текст',
    navTestId: 'nav-reader',
    navGroup: 'primary',
    home: {
      symbol: '文',
      title: 'Текст',
      action: 'Открыть',
      testId: 'open-reader',
      group: 'reference',
    },
  },
  {
    id: 'vocab',
    path: PATHS.vocab,
    documentTitle: 'Словарь — JP тренажёры',
    navLabel: 'Словарь',
    navTestId: 'nav-vocab',
    navGroup: 'primary',
    home: {
      symbol: '語',
      title: 'Словарь',
      action: 'Открыть',
      testId: 'open-vocab',
      group: 'reference',
    },
  },
  {
    id: 'mine',
    path: PATHS.mine,
    documentTitle: 'Мои слова — JP тренажёры',
    navLabel: 'Мои слова',
    navTestId: 'nav-mine',
    navGroup: 'primary',
    home: {
      symbol: '私',
      title: 'Мои слова',
      action: 'Открыть',
      testId: 'open-mine',
      group: 'reference',
    },
  },
  {
    id: 'theory',
    path: PATHS.theory,
    documentTitle: 'Теория — JP тренажёры',
    navLabel: 'Теория',
    navTestId: 'nav-theory',
    navGroup: 'primary',
    home: {
      symbol: '理',
      title: 'Теория',
      action: 'Открыть',
      testId: 'open-theory',
      group: 'reference',
    },
  },
  {
    id: 'analytics',
    path: PATHS.analytics,
    documentTitle: 'Аналитика — JP тренажёры',
    navLabel: 'Аналитика',
    navTestId: 'nav-analytics',
    navGroup: 'primary',
    home: {
      symbol: '統',
      title: 'Аналитика',
      action: 'Открыть',
      testId: 'open-analytics',
      group: 'reference',
    },
  },
  {
    id: 'accounts',
    path: PATHS.accounts,
    documentTitle: 'Аккаунты — JP тренажёры',
    navLabel: 'Аккаунты',
    navTestId: 'nav-accounts',
    navGroup: 'none',
  },
]

const PAGE_BY_ID = Object.fromEntries(PAGE_META.map((page) => [page.id, page])) as Record<
  AppPage,
  PageMeta
>
const PAGE_BY_PATH = new Map(PAGE_META.map((page) => [page.path, page]))

export function getPageMeta(id: AppPage): PageMeta {
  return PAGE_BY_ID[id]
}

export function navItems(group: Exclude<NavGroup, 'none'>): PageMeta[] {
  return PAGE_META.filter((page) => page.navGroup === group)
}

export function homeEntries(group?: HomeGroup): Array<PageMeta & { home: HomeEntryMeta }> {
  return PAGE_META.filter(
    (page): page is PageMeta & { home: HomeEntryMeta } =>
      Boolean(page.home) && (group ? page.home!.group === group : true),
  )
}

export function titleForPage(id: AppPage): string {
  return PAGE_BY_ID[id].documentTitle
}

export function pathForPage(page: AppPage): string {
  return PAGE_BY_ID[page].path
}

export function pageFromPath(pathname: string): AppPage | null {
  const aliased = PATH_ALIASES[pathname]
  if (aliased) return aliased
  return PAGE_BY_PATH.get(pathname)?.id ?? null
}

export function isKnownPagePath(pathname: string): boolean {
  return pathname in PATH_ALIASES || PAGE_BY_PATH.has(pathname)
}
