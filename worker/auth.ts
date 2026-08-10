export const MIN_PASSWORD_LENGTH = 4
export const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BITS = 256

export function validatePassword(password: string): string | null {
  if (!password) return 'Введите пароль'
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль не короче ${MIN_PASSWORD_LENGTH} символов`
  }
  return null
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(
  password: string,
  saltBase64?: string,
): Promise<{ salt: string; hash: string }> {
  const err = validatePassword(password)
  if (err) throw new Error(err)
  const salt =
    saltBase64 != null
      ? base64ToBytes(saltBase64)
      : crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveHash(password, salt)
  return { salt: bytesToBase64(salt), hash: bytesToBase64(hash) }
}

export async function verifyPassword(
  password: string,
  saltBase64: string,
  hashBase64: string,
): Promise<boolean> {
  if (!password || !saltBase64 || !hashBase64) return false
  try {
    const derived = await deriveHash(password, base64ToBytes(saltBase64))
    const expected = base64ToBytes(hashBase64)
    if (derived.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < derived.length; i += 1) diff |= derived[i]! ^ expected[i]!
    return diff === 0
  } catch {
    return false
  }
}

export function accountHasPassword(account: {
  passwordSalt?: string
  passwordHash?: string
}): boolean {
  return Boolean(account.passwordSalt && account.passwordHash)
}

export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${Date.now().toString(36)}_${hex}`
}

export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
