import { test } from '@playwright/test'
import { expect, openFreshApp } from './helpers.js'

test('home screen renders landing page', async ({ page }) => {
  await openFreshApp(page)
  await expect(page.getByTestId('nav-home')).toBeVisible()
  await expect(page.getByTestId('nav-kana')).toBeVisible()
  await expect(page.getByTestId('nav-kanji')).toBeVisible()
  await expect(page.getByTestId('nav-numbers')).toBeVisible()
  await expect(page.getByTestId('nav-vocab')).toBeVisible()
  await expect(page.getByTestId('nav-theory')).toBeVisible()
  await expect(page.getByTestId('open-kana')).toBeVisible()
  await expect(page.getByTestId('open-kanji')).toBeVisible()
  await expect(page.getByTestId('open-numbers')).toBeVisible()
  await expect(page.getByTestId('open-vocab')).toBeVisible()
  await expect(page.getByTestId('open-vocab-train')).toBeVisible()
  await expect(page.getByTestId('open-theory')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'JP тренажёры' })).toBeVisible()
})

test('header navigates to kana trainer', async ({ page }) => {
  await openFreshApp(page)
  await page.getByTestId('nav-kana').click()
  await expect(page).toHaveURL(/\/kana$/)
  await expect(page.getByTestId('start-practice')).toBeVisible()

  await page.getByTestId('nav-main').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('open-kana')).toBeVisible()
})

test('deep links open sections from URL', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear()
  })
  await page.goto('/vocab/train', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('vocab-setup')).toBeVisible()
  await expect(page).toHaveURL(/\/train$/)

  await page.goto('/train', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('train-page')).toBeVisible()
  await expect(page).toHaveURL(/\/train$/)

  await page.goto('/numbers', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('start-numbers')).toBeVisible()

  await page.goto('/unknown-path', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('open-kana')).toBeVisible()
})
