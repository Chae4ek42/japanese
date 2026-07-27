import type { KanjiComponentRef } from '../../shared/lib/types'
import {
  formatCompositionFormula,
  getComponent,
  getKanjiComponents,
  getKanjiInfo,
  getKanjiUsingComponent,
} from '../../data/words/bank'

const ROLE_RU: Record<string, string> = {
  radical: 'радикал',
  phonetic: 'фонетик',
  semantic: 'семантик',
  grapheme: 'графема',
  other: 'часть',
}

interface KanjiCompositionProps {
  character: string
  onOpenCharacter?: (character: string) => void
  compact?: boolean
  highlightElement?: string | null
  onHoverElement?: (element: string | null) => void
}

export function KanjiComposition({
  character,
  onOpenCharacter,
  compact = false,
  highlightElement = null,
  onHoverElement,
}: KanjiCompositionProps) {
  const info = getKanjiInfo(character)
  const components = getKanjiComponents(character)
  const formula = formatCompositionFormula(character)
  const mnemonic = info?.mnemonicRu || info?.compositionNoteRu
  const selfComponent = getComponent(character)
  const usedIn = selfComponent ? getKanjiUsingComponent(character, compact ? 8 : 16) : []

  if (!components.length && !mnemonic && !usedIn.length) {
    return null
  }

  return (
    <section className={compact ? 'kanji-composition is-compact' : 'kanji-composition'} data-testid="kanji-composition">
      <h4>Состав</h4>
      {components.length ? (
        <>
          <p className="kanji-composition-formula" data-testid="kanji-composition-formula">
            {formula}
          </p>
          <div className="kanji-composition-parts" data-testid="kanji-composition-parts">
            {components.map((part, index) => (
              <ComponentChip
                key={`${part.id}-${part.glyph}-${index}`}
                part={part}
                active={Boolean(
                  highlightElement &&
                    (highlightElement === part.id ||
                      highlightElement === part.glyph ||
                      part.id === highlightElement),
                )}
                onOpen={onOpenCharacter}
                onHover={onHoverElement}
              />
            ))}
          </div>
        </>
      ) : null}
      {mnemonic ? (
        <p className="kanji-composition-mnemonic" data-testid="kanji-composition-mnemonic">
          {mnemonic}
        </p>
      ) : null}
      {usedIn.length ? (
        <div className="kanji-composition-used" data-testid="kanji-composition-used">
          <span className="kanji-composition-used-label">Используется в</span>
          <div className="kanji-composition-used-list">
            {usedIn.map((item) => (
              <button
                key={item.character}
                type="button"
                className="kanji-composition-used-chip"
                data-testid={`kanji-used-in-${item.character}`}
                onClick={() => onOpenCharacter?.(item.character)}
                title={item.meaningsRu?.[0] || item.meanings[0] || item.levelLabel}
              >
                {item.character}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ComponentChip({
  part,
  active,
  onOpen,
  onHover,
}: {
  part: KanjiComponentRef
  active?: boolean
  onOpen?: (character: string) => void
  onHover?: (element: string | null) => void
}) {
  const catalog = getComponent(part.id)
  const clickable = Boolean(onOpen && (catalog || getKanjiInfo(part.id)))
  const meaning = part.meaningRu || catalog?.meaningsRu?.[0] || ''
  const role = ROLE_RU[part.role] ?? ROLE_RU.other
  const className = active ? 'kanji-composition-chip is-active' : 'kanji-composition-chip'

  const hoverHandlers = {
    onPointerEnter: () => onHover?.(part.id),
    onPointerLeave: () => onHover?.(null),
  }

  if (!clickable) {
    return (
      <span className={`${className} is-static`} title={role} {...hoverHandlers}>
        <span className="kanji-composition-chip-glyph">{part.glyph}</span>
        {meaning ? <span className="kanji-composition-chip-meaning">{meaning}</span> : null}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={className}
      data-testid={`kanji-component-${part.id}`}
      title={`${role}${meaning ? ` · ${meaning}` : ''}`}
      onClick={() => onOpen?.(part.id)}
      {...hoverHandlers}
    >
      <span className="kanji-composition-chip-glyph">{part.glyph}</span>
      {meaning ? <span className="kanji-composition-chip-meaning">{meaning}</span> : null}
    </button>
  )
}
