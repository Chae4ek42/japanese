import { chromium } from '@playwright/test'
import { KANA_STATS_CARDS } from '../src/data/kana.js'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4273'
const answerBySymbol = Object.fromEntries(KANA_STATS_CARDS.map((card) => [card.symbol, card.primaryAnswer]))

const browser = await chromium.launch()

async function practiceCards(page, count) {
  for (let i = 0; i < count; i += 1) {
    const symbol = await page.getByTestId('current-symbol').textContent()
    await page.getByTestId('answer-input').fill(answerBySymbol[symbol])
    await page.waitForTimeout(320)
  }
}

async function capture(viewport, suffix) {
  const page = await browser.newPage({ viewport })
  await page.goto(BASE_URL)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `test-results/shot-setup-${suffix}.png`, fullPage: true })

  await page.getByTestId('start-practice').click()
  await page.waitForTimeout(600)
  await practiceCards(page, 6)
  // Одна ошибка с путаницей: вводим ответ другой карточки.
  const symbol = await page.getByTestId('current-symbol').textContent()
  const wrong = symbol === 'あ' ? 'o' : 'a'
  await page.getByTestId('answer-input').fill(wrong)
  await page.waitForTimeout(200)
  await page.getByTestId('answer-input').fill(answerBySymbol[symbol])
  await page.waitForTimeout(400)
  await page.screenshot({ path: `test-results/shot-practice-${suffix}.png`, fullPage: true })

  await page.getByText('← Назад').click()
  await page.getByTestId('tab-stats').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `test-results/shot-stats-${suffix}.png`, fullPage: true })
  await page.close()
}

await capture({ width: 1440, height: 900 }, 'desktop')
await capture({ width: 390, height: 844 }, 'mobile')

await browser.close()
console.log('done')
