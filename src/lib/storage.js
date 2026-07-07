import { createCustomWordFromInput } from '../data/custom-words.js'
import {
  createDefaultAppState,
  CURRENT_VERSION,
  ensureWordStats,
  enrichStoredCustomWords,
  normalizeAppState,
} from '../../shared/app-state.js'

export {
  createDefaultAppState,
  createCustomWordFromInput,
  ensureWordStats,
  enrichStoredCustomWords,
  normalizeAppState,
  CURRENT_VERSION,
}

const LEGACY_STORAGE_KEY = 'kana-trainer-state-v1'
const USER_ID_KEY = 'kana-trainer-user-id'
const API_BASE = '/api'

let remoteEnabled = false
let currentUserId = null
let saveChain = Promise.resolve()

export function isRemoteStorageEnabled() {
  return remoteEnabled
}

export function getCurrentUserId() {
  return currentUserId
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })
  return response
}

async function checkApiHealth() {
  try {
    const response = await apiFetch('/health', { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

async function createRemoteUser() {
  const response = await apiFetch('/users', { method: 'POST' })
  if (!response.ok) {
    throw new Error('Не удалось создать пользователя')
  }
  const payload = await response.json()
  return payload.userId
}

async function fetchRemoteState(userId) {
  const response = await apiFetch(`/users/${userId}/state`, { method: 'GET' })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error('Не удалось загрузить состояние')
  }
  const payload = await response.json()
  return normalizeAppState(payload.state)
}

async function saveRemoteState(userId, state) {
  const response = await apiFetch(`/users/${userId}/state`, {
    method: 'PUT',
    body: JSON.stringify({ state }),
  })
  if (!response.ok) {
    throw new Error('Не удалось сохранить состояние')
  }
}

async function deleteRemoteState(userId) {
  const response = await apiFetch(`/users/${userId}/state`, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    throw new Error('Не удалось сбросить состояние')
  }
}

function loadLegacyLocalState() {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) {
      return createDefaultAppState()
    }
    return normalizeAppState(JSON.parse(raw)) ?? createDefaultAppState()
  } catch {
    return createDefaultAppState()
  }
}

function saveLegacyLocalState(state) {
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state))
}

function clearLegacyLocalState() {
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
}

function getOrCreateLocalUserId() {
  let userId = window.localStorage.getItem(USER_ID_KEY)
  if (!userId) {
    userId = crypto.randomUUID()
    window.localStorage.setItem(USER_ID_KEY, userId)
  }
  return userId
}

export async function bootstrapAppState() {
  remoteEnabled = await checkApiHealth()
  if (!remoteEnabled) {
    currentUserId = null
    return loadLegacyLocalState()
  }

  let userId = window.localStorage.getItem(USER_ID_KEY)
  if (!userId) {
    userId = await createRemoteUser()
    window.localStorage.setItem(USER_ID_KEY, userId)
  }
  currentUserId = userId

  const legacyState = loadLegacyLocalState()
  const hasLegacyData = window.localStorage.getItem(LEGACY_STORAGE_KEY) !== null

  try {
    const remoteState = await fetchRemoteState(userId)
    if (remoteState) {
      if (hasLegacyData) {
        clearLegacyLocalState()
      }
      return remoteState
    }

    if (hasLegacyData) {
      await saveRemoteState(userId, legacyState)
      clearLegacyLocalState()
      return legacyState
    }

    const freshState = createDefaultAppState()
    await saveRemoteState(userId, freshState)
    return freshState
  } catch {
    remoteEnabled = false
    currentUserId = null
    return legacyState
  }
}

export function saveAppState(state) {
  if (remoteEnabled && currentUserId) {
    saveChain = saveChain
      .then(() => saveRemoteState(currentUserId, state))
      .catch(() => {
        saveLegacyLocalState(state)
      })
    return
  }

  saveLegacyLocalState(state)
}

export async function flushAppState(state) {
  if (remoteEnabled && currentUserId) {
    await saveRemoteState(currentUserId, state)
    return
  }
  saveLegacyLocalState(state)
}

export async function resetStoredState() {
  clearLegacyLocalState()

  if (remoteEnabled && currentUserId) {
    try {
      await deleteRemoteState(currentUserId)
      const freshState = createDefaultAppState()
      await saveRemoteState(currentUserId, freshState)
      return
    } catch {
      remoteEnabled = false
    }
  }

  window.localStorage.removeItem(USER_ID_KEY)
  currentUserId = null
}

/** @deprecated Используйте bootstrapAppState в браузере. Оставлено для unit-тестов legacy. */
export function loadAppState(factory = createDefaultAppState) {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) {
      return factory()
    }
    return normalizeAppState(JSON.parse(raw)) ?? factory()
  } catch {
    return factory()
  }
}
