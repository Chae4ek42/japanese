import { expect } from '@playwright/test'

/** Fixed PBKDF2 fixture for password "test" (100k iterations, SHA-256). */
export const E2E_ACCOUNT_PASSWORD = 'test'
export const E2E_PASSWORD_SALT = 'AAAAAAAAAAAAAAAAAAAAAA=='
export const E2E_PASSWORD_HASH = '2jonN7v33cMAvv/2Z6Uu0R+V95oP9S8k1wiQ1sdSPD0='

/** Seed a signed-in local account so e2e can skip AccountGate. */
export function seedActiveAccountScript() {
  const id = 'acc_e2e_default'
  window.localStorage.clear()
  window.localStorage.setItem(
    'jp-accounts-meta-v1',
    JSON.stringify({
      activeId: id,
      accounts: [
        {
          id,
          name: 'Тест',
          createdAt: 1,
          passwordSalt: 'AAAAAAAAAAAAAAAAAAAAAA==',
          passwordHash: '2jonN7v33cMAvv/2Z6Uu0R+V95oP9S8k1wiQ1sdSPD0=',
        },
      ],
    }),
  )
}

export async function openFreshApp(page) {
  await page.addInitScript(seedActiveAccountScript)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('nav-home').waitFor({ state: 'visible' })
}

export async function openNumbersTrainer(page) {
  await page.getByTestId('nav-numbers').click()
}

export { expect }
