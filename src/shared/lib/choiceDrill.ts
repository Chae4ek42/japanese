export type ChoiceFlash<T extends string = string> = { pick: T; correct: boolean } | null

/** CSS classes for a multiple-choice pad (correct / wrong / reveal). */
export function choiceItemClass(
  base: string,
  option: string,
  flash: ChoiceFlash | null,
  answer?: string | null,
): string {
  const classes = [base]
  if (!flash) return classes.join(' ')
  if (option === flash.pick) {
    classes.push(flash.correct ? 'is-correct' : 'is-wrong')
  } else if (!flash.correct && option === answer) {
    classes.push('is-reveal')
  }
  return classes.join(' ')
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}

/**
 * Answer plus unique distractors, shuffled. `key` identifies duplicates.
 */
export function pickShuffledOptions<T>(
  answer: T,
  pool: T[],
  count: number,
  key: (item: T) => string,
  rng: () => number = Math.random,
): T[] {
  const unique = new Map<string, T>()
  unique.set(key(answer), answer)
  const rest = shuffleInPlace(
    pool.filter((item) => key(item) !== key(answer)),
    rng,
  )
  for (const item of rest) {
    if (unique.size >= count) break
    unique.set(key(item), item)
  }
  return shuffleInPlace([...unique.values()], rng)
}
