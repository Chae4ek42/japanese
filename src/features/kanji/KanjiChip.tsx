import { useIsMobileTouch } from '../../shared/lib/media'
import { useLongPress } from '../../shared/lib/useLongPress'
import '../../shared/styles/writing-hotspots.css'

export interface KanjiChipProps {
  character: string
  className?: string
  testId?: string
  onOpenInfo?: (character: string) => void
}

export function KanjiChip({
  character,
  className = 'kanji-chip',
  testId,
  onOpenInfo,
}: KanjiChipProps) {
  const isMobile = useIsMobileTouch()
  const longPress = useLongPress(onOpenInfo ? () => onOpenInfo(character) : undefined, {
    enabled: Boolean(onOpenInfo) && isMobile,
  })

  function handleAuxClick(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 1 || !onOpenInfo) return
    event.preventDefault()
    onOpenInfo(character)
  }

  const title = onOpenInfo
    ? isMobile
      ? 'Нажмите — карточка знака'
      : 'Колёсико — карточка знака'
    : undefined

  return (
    <button
      type="button"
      data-kanji-chip
      data-testid={testId ?? `kanji-chip-${character}`}
      className={className}
      title={title}
      aria-label={onOpenInfo ? `Карточка кандзи ${character}` : undefined}
      onClick={() => {
        if (isMobile) onOpenInfo?.(character)
      }}
      onAuxClick={handleAuxClick}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      {...longPress}
    >
      {character}
    </button>
  )
}
