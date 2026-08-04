import type { ReviewEvent } from '../types'

const DB_NAME = 'jp-review-journal'
const DB_VERSION = 1
const STORE = 'events'
const MAX_EVENTS = 20_000

type Listener = (events: ReviewEvent[]) => void

let memoryFallback: ReviewEvent[] = []
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'i', autoIncrement: true })
          store.createIndex('t', 't', { unique: false })
          store.createIndex('c', 'c', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    })
  }
  return dbPromise
}

async function trimStore(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const countReq = store.count()
    countReq.onsuccess = () => {
      const count = countReq.result
      if (count <= MAX_EVENTS) {
        resolve()
        return
      }
      const excess = count - MAX_EVENTS
      let deleted = 0
      const cursorReq = store.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor || deleted >= excess) {
          resolve()
          return
        }
        cursor.delete()
        deleted += 1
        cursor.continue()
      }
      cursorReq.onerror = () => reject(cursorReq.error)
    }
    countReq.onerror = () => reject(countReq.error)
    tx.onerror = () => reject(tx.error)
  })
}

export async function appendReviewEvent(event: ReviewEvent): Promise<void> {
  memoryFallback = [...memoryFallback, event].slice(-MAX_EVENTS)
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).add(event)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    await trimStore(db)
  } catch {
    // memoryFallback already updated
  }
}

export async function readReviewEvents(limit = MAX_EVENTS): Promise<ReviewEvent[]> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const req = store.getAll()
      req.onsuccess = () => {
        const rows = (req.result as ReviewEvent[]) ?? []
        resolve(rows.slice(-limit))
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return memoryFallback.slice(-limit)
  }
}

export async function clearReviewEvents(): Promise<void> {
  memoryFallback = []
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
}

/** Test helper: inject in-memory events without IndexedDB. */
export function __setMemoryJournalForTests(events: ReviewEvent[]): void {
  memoryFallback = [...events]
}

export function encodeReviewEvent(partial: {
  t: number
  c: string
  a: 0 | 1
  g: 1 | 2 | 3 | 4
  l: number
  e: number
  r: number
  s: number
  d: number
  m: 0 | 1 | 2
  distractor?: string
}): ReviewEvent {
  return {
    t: partial.t,
    c: partial.c,
    a: partial.a,
    g: partial.g,
    l: Math.max(0, Math.round(partial.l)),
    e: Math.round(partial.e * 1000) / 1000,
    r: Math.round(clamp01(partial.r) * 1000),
    s: Math.round(partial.s * 10),
    d: Math.round(partial.d * 100),
    m: partial.m,
    ...(partial.distractor ? { x: partial.distractor } : {}),
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

// Silence unused listener type in case UI subscribes later.
export type ReviewJournalListener = Listener
