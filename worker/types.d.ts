/** Minimal Cloudflare Worker typings for local typecheck / tests. */
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
