import pg from 'pg'
import { createDefaultAppState, normalizeAppState } from '../../shared/app-state.js'

const { Pool } = pg

let pool

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  }
  return pool
}

export async function waitForDatabase(retries = 30, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const client = await getPool().connect()
      await client.query('SELECT 1')
      client.release()
      return
    } catch (error) {
      if (attempt === retries) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export async function createUser() {
  const result = await getPool().query(
    `INSERT INTO trainer_users DEFAULT VALUES
     RETURNING id`,
  )
  return result.rows[0].id
}

export async function ensureUserExists(userId) {
  await getPool().query(
    `INSERT INTO trainer_users (id)
     VALUES ($1)
     ON CONFLICT (id) DO NOTHING`,
    [userId],
  )
  return true
}

export async function getUserState(userId) {
  const result = await getPool().query(
    `SELECT state
     FROM trainer_app_state
     WHERE user_id = $1`,
    [userId],
  )
  if (result.rowCount === 0) {
    return null
  }
  return normalizeAppState(result.rows[0].state)
}

export async function saveUserState(userId, state) {
  const normalized = normalizeAppState(state) ?? createDefaultAppState()
  await getPool().query(
    `INSERT INTO trainer_app_state (user_id, state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    [userId, JSON.stringify(normalized)],
  )
  return normalized
}

export async function deleteUserState(userId) {
  await getPool().query('DELETE FROM trainer_app_state WHERE user_id = $1', [userId])
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}
