import { expect } from '@playwright/test'

const E2E_ACCOUNT = {
  id: 'acc_e2e_default',
  name: 'Тест',
  createdAt: 1,
  hasPassword: true,
}

/** Mock server accounts API for e2e (shared registry). */
export async function mockAccountsApi(page) {
  let remoteState = null
  const accounts = [structuredClone(E2E_ACCOUNT)]

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method().toUpperCase()

    if (path === '/api/accounts' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accounts }),
      })
      return
    }

    if (path === `/api/accounts/${E2E_ACCOUNT.id}/state`) {
      if (method === 'GET') {
        if (!remoteState) {
          await route.fulfill({ status: 404, body: '' })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: remoteState,
        })
        return
      }
      if (method === 'PUT') {
        remoteState = request.postData() ?? ''
        await route.fulfill({ status: 204, body: '' })
        return
      }
    }

    if (path === '/api/session/logout' && method === 'POST') {
      await route.fulfill({ status: 204, body: '' })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `unmocked ${method} ${path}` }),
    })
  })
}

export function seedActiveAccountScript() {
  window.localStorage.clear()
  window.localStorage.setItem(
    'jp-account-session-v1',
    JSON.stringify({
      token: 'e2e-token',
      accountId: 'acc_e2e_default',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  )
}

export async function openFreshApp(page) {
  await mockAccountsApi(page)
  await page.addInitScript(seedActiveAccountScript)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('nav-home').waitFor({ state: 'visible' })
}

export async function openNumbersTrainer(page) {
  await page.getByTestId('nav-numbers').click()
}

export { expect }
