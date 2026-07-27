import { useEffect, useRef, useState } from 'react'
import {
  componentMatchKeys,
  extractStrokePathsSvg,
  getKvgAttr,
  groupMatchesTarget,
  kanjivgSvgUrl,
} from './kanjivg'
import { getComponent, getKanjiComponents, getKanjiInfo, getKanjiUsingComponent } from '../../data/words/bank'

export interface GlyphHoverInfo {
  element: string
  displayGlyph: string
  original?: string
  position?: string
  radicalType?: string
  phonetic?: string
  meanings: string[]
  meaningsRu: string[]
  roleRu?: string
  kindRu?: string
  levelLabel?: string
  joyo?: boolean
  strokes?: number | null
  onyomi: string[]
  kunyomi: string[]
  mnemonicRu?: string
  usedInCount: number
  usedInSample: string[]
  inBank: boolean
  canOpen: boolean
}

interface KanjiGlyphProps {
  character: string
  highlightElement?: string | null
  onHoverElement?: (element: string | null, info: GlyphHoverInfo | null) => void
  /** Middle-click a component to open its card. */
  onActivateElement?: (element: string) => void
  onAuxClickCharacter?: (event: React.MouseEvent<HTMLElement>) => void
  size?: 'card' | 'hero'
  className?: string
  testId?: string
}

const ROLE_RU: Record<string, string> = {
  radical: 'радикал',
  phonetic: 'фонетик',
  semantic: 'семантик',
  grapheme: 'графема',
  other: 'часть',
}

const KIND_RU: Record<string, string> = {
  kanji: 'кандзи',
  radical: 'радикал',
  grapheme: 'графема',
}

function uniq(values: Array<string | null | undefined>): string[] {
  const out: string[] = []
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text && !out.includes(text)) out.push(text)
  }
  return out
}

function buildHoverInfo(
  character: string,
  element: string,
  extras: {
    original?: string
    position?: string
    radicalType?: string
    phonetic?: string
  } = {},
): GlyphHoverInfo {
  const lookupKeys = componentMatchKeys(extras.original || element)
  const bankParts = getKanjiComponents(character)
  const matchedPart = bankParts.find((part) => lookupKeys.includes(part.id) || lookupKeys.includes(part.glyph))
  const lookupId = matchedPart?.id ?? extras.original ?? element
  const catalog = getComponent(lookupId)
  const info = getKanjiInfo(lookupId)
  const used = getKanjiUsingComponent(lookupId, 8)
  const usedInCount = catalog?.usedIn?.length ?? used.length

  const meaningsRu = uniq([
    matchedPart?.meaningRu,
    matchedPart?.nameRu,
    ...(catalog?.meaningsRu ?? []),
    ...(info?.meaningsRu ?? []),
  ])
  const meanings = uniq([...(info?.meanings ?? []), ...meaningsRu])

  let roleRu = matchedPart ? ROLE_RU[matchedPart.role] ?? ROLE_RU.other : undefined
  if (!roleRu && extras.phonetic) roleRu = ROLE_RU.phonetic
  if (!roleRu && extras.radicalType) roleRu = ROLE_RU.radical

  return {
    element,
    displayGlyph: extras.original || matchedPart?.glyph || element,
    original: extras.original,
    position: extras.position,
    radicalType: extras.radicalType,
    phonetic: extras.phonetic,
    meanings,
    meaningsRu,
    roleRu,
    kindRu: catalog ? KIND_RU[catalog.kind] : info ? KIND_RU.kanji : undefined,
    levelLabel: info?.levelLabel,
    joyo: info?.joyo,
    strokes: info?.strokes ?? catalog?.strokes ?? null,
    onyomi: info?.onyomi ?? [],
    kunyomi: info?.kunyomi ?? [],
    mnemonicRu: catalog?.mnemonicRu || info?.mnemonicRu || info?.compositionNoteRu,
    usedInCount,
    usedInSample: (catalog?.usedIn ?? used.map((item) => item.character)).slice(0, 8),
    inBank: Boolean(matchedPart || catalog || info),
    canOpen: Boolean(catalog || info),
  }
}

function resolveHoverInfo(character: string, group: Element): GlyphHoverInfo | null {
  const element = getKvgAttr(group, 'element')
  if (!element || element === character) return null

  return buildHoverInfo(character, element, {
    original: getKvgAttr(group, 'original') ?? undefined,
    position: getKvgAttr(group, 'position') ?? undefined,
    radicalType: getKvgAttr(group, 'radical') ?? undefined,
    phonetic: getKvgAttr(group, 'phon') ?? undefined,
  })
}

function findHoverGroup(target: EventTarget | null, root: SVGSVGElement, character: string): Element | null {
  if (!(target instanceof Element)) return null
  let node: Element | null = target
  let best: Element | null = null
  while (node && node !== root) {
    const element = getKvgAttr(node, 'element')
    if (element && element !== character && node.tagName.toLowerCase() === 'g') {
      best = node
    }
    node = node.parentElement
  }
  return best
}

export function KanjiGlyph({
  character,
  highlightElement = null,
  onHoverElement,
  onActivateElement,
  onAuxClickCharacter,
  size = 'card',
  className = '',
  testId = 'kanji-glyph',
}: KanjiGlyphProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const hoverRef = useRef<GlyphHoverInfo | null>(null)

  useEffect(() => {
    const url = kanjivgSvgUrl(character)
    const host = hostRef.current
    if (!url || !host) {
      setStatus('fallback')
      return undefined
    }

    let cancelled = false
    setStatus('loading')
    hoverRef.current = null
    host.replaceChildren()

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.text()
      })
      .then((text) => {
        if (cancelled) return
        const svg = extractStrokePathsSvg(text)
        if (!svg) {
          setStatus('fallback')
          return
        }
        svg.classList.add('kanji-glyph-svg')
        host.replaceChildren(svg)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('fallback')
      })

    return () => {
      cancelled = true
    }
  }, [character])

  useEffect(() => {
    const host = hostRef.current
    const svg = host?.querySelector('svg')
    if (!svg || status !== 'ready') return

    svg.classList.toggle('is-hovering', Boolean(highlightElement))
    for (const group of svg.querySelectorAll('g')) {
      group.classList.remove('is-highlighted')
      if (highlightElement && groupMatchesTarget(group, highlightElement)) {
        group.classList.add('is-highlighted')
      }
    }
  }, [highlightElement, status, character])

  function emitHover(group: Element | null) {
    if (!group) return
    const info = resolveHoverInfo(character, group)
    if (!info) return
    const prev = hoverRef.current
    if (
      prev &&
      prev.element === info.element &&
      prev.original === info.original &&
      prev.position === info.position
    ) {
      return
    }
    hoverRef.current = info
    onHoverElement?.(info.original || info.element, info)
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (status !== 'ready') return
    const svg = hostRef.current?.querySelector('svg')
    if (!svg) return
    const group = findHoverGroup(event.target, svg, character)
    emitHover(group)
  }

  function handlePointerLeave() {
    hoverRef.current = null
    onHoverElement?.(null, null)
  }

  function handleAuxClick(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 1) return
    event.preventDefault()

    if (status === 'ready' && onActivateElement) {
      const svg = hostRef.current?.querySelector('svg')
      if (svg) {
        const group = findHoverGroup(event.target, svg, character)
        const info = group ? resolveHoverInfo(character, group) : null
        if (info?.canOpen) {
          onActivateElement(info.original || info.element)
          return
        }
      }
    }

    onAuxClickCharacter?.(event)
  }

  return (
    <div
      className={`kanji-glyph kanji-glyph-${size} ${status === 'ready' ? 'is-ready' : ''} ${className}`.trim()}
      data-testid={testId}
      title={onActivateElement ? 'Колёсико по части знака — открыть карточку' : undefined}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onAuxClick={handleAuxClick}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
    >
      <div className="kanji-glyph-stage">
        <div ref={hostRef} className="kanji-glyph-host" aria-hidden={status === 'fallback'} />
        {status !== 'ready' ? (
          <span className="kanji-glyph-fallback" data-testid={`${testId}-fallback`}>
            {character}
          </span>
        ) : null}
      </div>
    </div>
  )
}
