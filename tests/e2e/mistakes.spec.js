import { test } from '@playwright/test'
import { expect, mockAccountsApi, openFreshApp } from './helpers.js'

test('mistake journal opens an exact kana pair and retains its pool after remount', async ({ page }) => {
  await mockAccountsApi(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('mistakes-seeded')) return
    sessionStorage.setItem('mistakes-seeded', '1')
    localStorage.setItem('jp-account-session-v1', JSON.stringify({
      token: 'e2e-token', accountId: 'acc_e2e_default', expiresAt: Date.now() + 86400000,
    }))
  })
  await page.goto('/')
  await expect(page.getByTestId('nav-kana')).toBeVisible()
  const symbols = await page.evaluate(async () => {
    const { createDefaultAppState } = await import('/src/shared/state/app-state.ts')
    const { createStatsRecord } = await import('/src/shared/lib/trainer.ts')
    const { KANA_STATS_CARDS } = await import('/src/data/kana.ts')
    const [first, second] = KANA_STATS_CARDS
    const state = createDefaultAppState()
    state.kana.stats[first.id] = { ...createStatsRecord(), errors: 3, lastErrorAt: Date.now() }
    state.kana.history.confusions[`${first.id}>${second.id}`] = 2
    localStorage.setItem('jp-state-draft-v1:acc_e2e_default', JSON.stringify(state))
    return [first.symbol, second.symbol]
  })
  await page.goto('/mistakes')
  await expect(page.getByTestId('mistake-card')).toHaveCount(1)
  await expect(page.getByTestId('mistake-card')).toContainText('Путаница')
  await page.getByRole('button', { name: 'Потренировать пару' }).click()
  await expect(page.getByTestId('current-symbol')).toBeVisible()
  expect(symbols).toContain(await page.getByTestId('current-symbol').innerText())
  await page.getByTestId('nav-main').click()
  await page.getByTestId('nav-kana').click()
  await expect(page.getByTestId('current-symbol')).toBeVisible()
  expect(symbols).toContain(await page.getByTestId('current-symbol').innerText())
  await page.reload()
  await expect(page.getByTestId('current-symbol')).toBeVisible()
  expect(symbols).toContain(await page.getByTestId('current-symbol').innerText())
})

for (const section of ['numbers', 'particles', 'verbs']) {
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
