/** Minimal Cloudflare Worker typings for local typecheck / tests. */

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[]
  success: boolean
  meta?: Record<string, unknown>
  error?: string
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}

interface D1ExecResult {
  count: number
  duration: number
}

/** Optional legacy binding for one-time import into D1. */
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

interface Fetcher {
  fetch(request: Request): Promise<Response>
}
