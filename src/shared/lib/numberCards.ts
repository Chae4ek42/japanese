import { buildNumberPool } from '../../data/numbers'
import type { NumberCard } from './types'

let cards: NumberCard[] | undefined

/** The complete supported bank, independent of the trainer's current setup. */
export function allNumberCards(): NumberCard[] {
  cards ??= (['plain', 'age', 'counter', 'clock'] as const).flatMap((mode) =>
    buildNumberPool({ mode, rangeMin: 1, rangeMax: 999 }),
  )
  return cards
}
