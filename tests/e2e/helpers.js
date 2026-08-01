import { expect } from '@playwright/test'

export async function openFreshApp(page) {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('nav-home').waitFor({ state: 'visible' })
}

export async function openNumbersTrainer(page) {
  await page.getByTestId('nav-numbers').click()
}

export { expect }
