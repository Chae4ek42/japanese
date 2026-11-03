import { test } from '@playwright/test'
import { expect, mockAccountsApi, openFreshApp } from './helpers.js'

test('difficulties show only evidenced words and add them to the active set independently of My Words', async ({ page }) => {
  await mockAccountsApi(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('word-difficulties-seeded')) return
    sessionStorage.setItem('word-difficulties-seeded', '1')
    localStorage.clear()
    localStorage.setItem('jp-account-session-v1', JSON.stringify({
      token: 'e2e-token', accountId: 'acc_e2e_default', expiresAt: Date.now() + 86400000,
    }))
    const definitions = [
      ['hard', '難語', 'трудное слово'], ['unsaved', '別語', 'другое слово'],
      ['fresh', '新語', 'мало ответов'], ['recovered', '済語', 'уже закреплено'],
    ]
    const customWords = Object.fromEntries(definitions.map(([key, writing, meaning]) => [`custom:${key}`, {
      id: `custom:${key}`, writing, kana: 'ことば', romaji: 'kotoba', meanings: [meaning], kanji: [],
    }]))
    const stats = (answers) => ({
      exposures: answers.length, clears: answers.filter((answer) => answer === 'correct').length,
      errors: answers.filter((answer) => answer === 'wrong').length, hints: 0, streak: 0, bestStreak: 0,
      mastery: 0.2, avgLatencyMs: 0, fastestLatencyMs: 0, lastSeenAt: Date.now(),
      lastClearAt: 0, lastErrorAt: Date.now(), lastHintAt: 0, eventAccuracy: 0, recentAnswers: answers,
    })
    localStorage.setItem('jp-state-draft-v1:acc_e2e_default', JSON.stringify({
      version: 32,
      kana: { stats: { 'hiragana:a': stats(Array(10).fill('wrong')) } },
      vocab: {
        myWords: ['custom:hard', 'custom:fresh', 'custom:recovered'], customWords,
        trainingSets: [
          { id: 'main', name: 'Основной', wordIds: [], createdAt: 1, updatedAt: 1 },
          { id: 'review-target', name: 'Закрепить', wordIds: [], createdAt: 2, updatedAt: 2 },
        ],
        activeTrainingSetId: 'review-target',
        stats: {
          'custom:hard': stats(Array(10).fill('wrong')),
          'custom:unsaved': stats(['correct', 'correct', 'correct', 'wrong', 'wrong']),
          'custom:fresh': stats(Array(4).fill('wrong')),
          'custom:recovered': stats([...Array(5).fill('wrong'), ...Array(10).fill('correct')]),
        },
      },
    }))
  })
  await page.goto('/mistakes', { waitUntil: 'domcontentloaded' })
  const journal = page.getByTestId('mistakes-page')
  await expect(journal.getByRole('heading', { name: /Трудности/ })).toBeVisible()
  await expect(journal.getByTestId('mistake-card')).toHaveCount(2)
  await expect(journal).not.toContainText('新語')
  await expect(journal).not.toContainText('済語')
  await expect(journal.getByRole('button', { name: /Потренировать|Начать|Тренировать/ })).toHaveCount(0)
  await expect(journal.getByTestId('mistakes-section-filter')).toHaveCount(0)
  await expect(journal).toContainText('Закрепить')
  const hard = journal.getByTestId('mistake-card').filter({ hasText: '難語' })
  await expect(hard).toContainText('10 из 10 последних ответов')
  await hard.getByRole('button', { name: '+ В набор', exact: true }).click()
  await expect(hard.getByRole('button', { name: 'В наборе', exact: true })).toBeDisabled()
  await journal.getByRole('button', { name: 'Добавить все в набор' }).click()
  await expect(journal.getByRole('button', { name: 'В наборе', exact: true })).toHaveCount(2)

  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect.poll(async () => page.evaluate(() => {
    const vocab = JSON.parse(localStorage.getItem('jp-state-draft-v1:acc_e2e_default') ?? '{}').vocab
    return vocab?.trainingSets?.find((set) => set.id === 'review-target')?.wordIds ?? []
  })).toEqual(['custom:hard', 'custom:unsaved'])
  const memberships = await page.evaluate(() => {
    const { vocab } = JSON.parse(localStorage.getItem('jp-state-draft-v1:acc_e2e_default'))
    return { mine: vocab.myWords, main: vocab.trainingSets.find((set) => set.id === 'main').wordIds }
  })
  expect(memberships.mine).toEqual(['custom:hard', 'custom:fresh', 'custom:recovered'])
  expect(memberships.main).toEqual([])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('mistake-card')).toHaveCount(2)
  await expect(page.getByTestId('mistakes-page').getByRole('button', { name: 'В наборе', exact: true })).toHaveCount(2)
})

for (const section of ['numbers']) {
  test(`${section}: targeted intent starts exact card and survives navigation`, async ({ page }) => {
    await openFreshApp(page)
    const target = await page.evaluate(async (section) => {
      const { requestTargetedPractice } = await import('/src/shared/lib/targetedPractice.ts')
      let card
      if (section === 'numbers') {
        const { allNumberCards } = await import('/src/shared/lib/numberCards.ts')
        card = allNumberCards().find((card) => card.mode === 'clock')
      } else if (section === 'particles') {
        const { buildParticlePool } = await import('/src/data/particles.ts')
        card = buildParticlePool('all')[0]
      } else {
        const { buildVerbPool } = await import('/src/data/verbs.ts')
        card = buildVerbPool('all')[0]
      }
      requestTargetedPractice({ section, cardIds: [card.id] })
      return { id: card.id, text: card.symbol ?? card.glossRu ?? card.dictionary.writing }
    }, section)
    const prompt = section === 'numbers' ? 'current-number' : section === 'particles' ? 'particles-gloss' : 'verb-prompt'
    await page.getByTestId(`nav-${section}`).click()
    await expect(page.getByTestId(prompt)).toHaveText(target.text)
    await page.getByTestId('nav-main').click()
    await page.getByTestId(`nav-${section}`).click()
    await expect(page.getByTestId(prompt)).toHaveText(target.text)
    expect(await page.evaluate(() => sessionStorage.getItem('jp:targeted-practice:v1'))).toBeNull()
  })
}
