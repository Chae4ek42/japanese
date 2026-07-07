import express from 'express'
import cors from 'cors'
import {
  closePool,
  createUser,
  deleteUserState,
  ensureUserExists,
  getUserState,
  saveUserState,
  waitForDatabase,
} from './db.js'
import { createDefaultAppState } from '../../shared/app-state.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(cors())
app.use(express.json({ limit: '4mb' }))

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

app.get('/api/health', async (_request, response) => {
  try {
    await waitForDatabase(1, 0)
    response.json({ ok: true })
  } catch {
    response.status(503).json({ ok: false })
  }
})

app.post('/api/users', async (_request, response) => {
  try {
    const userId = await createUser()
    const state = createDefaultAppState()
    await saveUserState(userId, state)
    response.status(201).json({ userId })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'failed_to_create_user' })
  }
})

app.get('/api/users/:userId/state', async (request, response) => {
  const { userId } = request.params
  if (!isUuid(userId)) {
    response.status(400).json({ error: 'invalid_user_id' })
    return
  }

  try {
    await ensureUserExists(userId)
    const state = await getUserState(userId)
    if (!state) {
      response.status(404).json({ error: 'state_not_found' })
      return
    }

    response.json({ state })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'failed_to_load_state' })
  }
})

app.put('/api/users/:userId/state', async (request, response) => {
  const { userId } = request.params
  if (!isUuid(userId)) {
    response.status(400).json({ error: 'invalid_user_id' })
    return
  }

  if (!request.body?.state) {
    response.status(400).json({ error: 'state_required' })
    return
  }

  try {
    await ensureUserExists(userId)
    const state = await saveUserState(userId, request.body.state)
    response.json({ state })
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'failed_to_save_state' })
  }
})

app.delete('/api/users/:userId/state', async (request, response) => {
  const { userId } = request.params
  if (!isUuid(userId)) {
    response.status(400).json({ error: 'invalid_user_id' })
    return
  }

  try {
    await deleteUserState(userId)
    response.status(204).end()
  } catch (error) {
    console.error(error)
    response.status(500).json({ error: 'failed_to_reset_state' })
  }
})

async function start() {
  await waitForDatabase()
  app.listen(port, '0.0.0.0', () => {
    console.log(`API listening on :${port}`)
  })
}

start().catch((error) => {
  console.error('Failed to start API', error)
  process.exit(1)
})

process.on('SIGTERM', async () => {
  await closePool()
  process.exit(0)
})
