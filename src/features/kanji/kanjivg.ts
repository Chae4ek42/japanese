const KANJIVG_CDN =
  'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji'

export function kanjiToKanjivgId(character: string): string | null {
  const code = character.codePointAt(0)
  if (code === undefined) return null
  return code.toString(16).padStart(5, '0')
}

export function kanjivgSvgUrl(character: string): string | null {
  const id = kanjiToKanjivgId(character)
  if (!id) return null
  return `${KANJIVG_CDN}/${id}.svg`
}

export function getKvgAttr(element: Element, name: string): string | null {
  return (
    element.getAttribute(`kvg:${name}`) ??
    element.getAttributeNS('http://kanjivg.tagaini.net', name) ??
    element.getAttributeNS('https://kanjivg.tagaini.net/', name)
  )
}

/** Glyph forms that often appear as radicals / variants of a bank component. */
const VARIANT_FORMS: Record<string, string[]> = {
  人: ['亻', '𠆢'],
  心: ['忄', '⺖'],
  手: ['扌', '龵'],
  水: ['氵', '氺', '⺡'],
  火: ['灬'],
  犬: ['犭'],
  糸: ['糹'],
  肉: ['⺼', '月'],
  邑: ['阝'],
  阜: ['阝'],
  艸: ['艹'],
  衣: ['衤'],
  示: ['礻'],
  竹: ['⺮'],
  网: ['罒', '罓'],
  言: ['訁'],
  金: ['釒'],
  食: ['飠', '𩙿'],
  辵: ['辶', '⻌', '⻍'],
}

export function componentMatchKeys(idOrGlyph: string): string[] {
  const keys = new Set<string>([idOrGlyph])
  for (const variant of VARIANT_FORMS[idOrGlyph] ?? []) {
    keys.add(variant)
  }
  for (const [base, variants] of Object.entries(VARIANT_FORMS)) {
    if (variants.includes(idOrGlyph)) {
      keys.add(base)
      for (const variant of variants) keys.add(variant)
    }
  }
  return [...keys]
}

export function groupMatchesTarget(group: Element, target: string): boolean {
  const keys = new Set(componentMatchKeys(target))
  const element = getKvgAttr(group, 'element')
  const original = getKvgAttr(group, 'original')
  return Boolean((element && keys.has(element)) || (original && keys.has(original)))
}

export function extractStrokePathsSvg(svgText: string): SVGSVGElement | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return null
  const svg = doc.querySelector('svg')
  if (!svg) return null

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('width')
  clone.removeAttribute('height')
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  for (const node of [...clone.querySelectorAll('[id*="StrokeNumbers"]')]) {
    node.remove()
  }

  return clone
}
