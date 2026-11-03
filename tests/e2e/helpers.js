import { expect } from '@playwright/test'

const E2E_ACCOUNT = {
  id: 'acc_e2e_default',
  name: 'Тест',
  createdAt: 1,
  hasPassword: true,
}

/** Mock server accounts API for e2e (shared registry). */
export async function mockAccountsApi(page) {
  // Keep functional browser checks independent of external font availability.
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
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

export async function clickNav(page, testId) {
  await page.getByTestId(testId).click()
}

export async function openNumbersTrainer(page) {
  await page.getByTestId('nav-numbers').click()
}

/** Trusted touch events exercise the browser's scroll and click arbitration. */
export async function swipeTouch(page, locator, { dx = -120, dy = 0 } = {}) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error('Swipe target is not visible')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const viewport = page.viewportSize()
  const endX = Math.max(12, Math.min(viewport.width - 12, x + dx))
  const endY = Math.max(12, Math.min(viewport.height - 12, y + dy))
  const client = await page.context().newCDPSession(page)
  try {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
    for (let step = 1; step <= 8; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + (endX - x) * step / 8, y: y + (endY - y) * step / 8, id: 1 }],
      })
      await page.waitForTimeout(16)
    }
    // Finish at rest rather than releasing a high-velocity native fling.
    for (let frame = 0; frame < 6; frame += 1) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: endX, y: endY, id: 1 }] })
      await page.waitForTimeout(16)
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    // Let native scrolling settle before the next tap; a fling consumes its first tap.
    await page.evaluate(() => new Promise((resolve) => {
      let previous = window.scrollY
      let stable = 0
      let frames = 0
      const tick = () => {
        const current = window.scrollY
        stable = Math.abs(current - previous) < 0.5 ? stable + 1 : 0
        previous = current
        if (stable >= 4 || frames++ >= 60) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }))
  } finally {
    await client.detach()
  }
}

export { expect }
