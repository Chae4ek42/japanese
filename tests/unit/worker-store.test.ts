import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultAccountName,
  publicAccount,
  sanitizeName,
} from '../../worker/store.ts'
import { accountHasPassword } from '../../worker/auth.ts'

describe('worker store helpers', () => {
  it('sanitizeName и defaultAccountName', () => {
    assert.equal(sanitizeName('  Аня  '), 'Аня')
    assert.equal(sanitizeName(''), 'Аккаунт')
    assert.equal(defaultAccountName([]), 'Аккаунт')
    assert.equal(
      defaultAccountName([{ id: '1', name: 'Аккаунт', createdAt: 1 }]),
      'Аккаунт 2',
    )
  })

  it('publicAccount скрывает хэши', () => {
    const pub = publicAccount({
      id: 'a',
      name: 'Тест',
      createdAt: 1,
      passwordSalt: 's',
      passwordHash: 'h',
    })
    assert.deepEqual(pub, {
      id: 'a',
      name: 'Тест',
      createdAt: 1,
      hasPassword: true,
    })
    assert.equal(accountHasPassword({ passwordSalt: 's', passwordHash: 'h' }), true)
  })
})
