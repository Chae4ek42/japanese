import { chromium } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4273'
const browser = await chromium.launch()

async function run(viewport, suffix) {
  const page = await browser.newPage({ viewport })
  await page.goto(BASE_URL)
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await page.getByTestId('tab-words').click()
  await page.getByTestId('toggle-word-list').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `test-results/shot-words-setup-${suffix}.png`, fullPage: true })

  await page.getByTestId('start-words').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `test-results/shot-words-practice-${suffix}.png`, fullPage: true })

  await page.getByText('← Назад').click()
  await page.getByTestId('word-answer-translation').click()
  await page.getByTestId('start-words').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `test-results/shot-words-translation-${suffix}.png`, fullPage: true })
  await page.close()
}

await run({ width: 1440, height: 900 }, 'desktop')
await run({ width: 390, height: 844 }, 'mobile')
await browser.close()
console.log('done')
