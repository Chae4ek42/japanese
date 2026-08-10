import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AuthError,
  hashPassword,
  validatePassword,
  verifyPassword,
} from '../../src/shared/lib/account-auth.ts'

const FIXTURE_SALT = 'AAAAAAAAAAAAAAAAAAAAAA=='
/** PBKDF2-SHA-256 / 100k for password "test" with FIXTURE_SALT */
const FIXTURE_HASH = '2jonN7v33cMAvv/2Z6Uu0R+V95oP9S8k1wiQ1sdSPD0='

describe('account-auth', () => {
  it('hash/verify round-trip', async () => {
    const { salt, hash } = await hashPassword('secret1')
    assert.equal(await verifyPassword('secret1', salt, hash), true)
    assert.equal(await verifyPassword('secret2', salt, hash), false)
  })

  it('детерминирован с фиксированной солью', async () => {
    const { salt, hash } = await hashPassword('test', FIXTURE_SALT)
    assert.equal(salt, FIXTURE_SALT)
    assert.equal(hash, FIXTURE_HASH)
    assert.equal(await verifyPassword('test', FIXTURE_SALT, FIXTURE_HASH), true)
    assert.equal(await verifyPassword('wrong', FIXTURE_SALT, FIXTURE_HASH), false)
  })

  it('отклоняет короткий пароль', () => {
    assert.throws(() => validatePassword('ab'), (error: unknown) => error instanceof AuthError)
    assert.throws(
      () => validatePassword(''),
      (error: unknown) => error instanceof AuthError && (error as AuthError).code === 'missing',
    )
  })
})
