import { describe, it, expect } from 'vitest'
import { pickMailbox } from '../../src/lib/email-threads'

const box = (o: Partial<Parameters<typeof pickMailbox>[0][number]>) => ({
  userId: 'u1',
  email: 'u1@pasparisien.fr',
  connected: true,
  sendingEnabled: true,
  ...o,
})

describe('pickMailbox', () => {
  it('prend le 1er candidat connecte ET pilote', () => {
    expect(pickMailbox([box({ userId: 'actor', email: 'a@x.fr' })])).toEqual({
      userId: 'actor',
      email: 'a@x.fr',
    })
  })
  it('saute un candidat non pilote (sending_enabled false)', () => {
    expect(
      pickMailbox([
        box({ userId: 'actor', sendingEnabled: false }),
        box({ userId: 'assigned', email: 'as@x.fr' }),
      ])
    ).toEqual({ userId: 'assigned', email: 'as@x.fr' })
  })
  it('null si aucune boite connectee+pilote ou email manquant', () => {
    expect(pickMailbox([box({ connected: false })])).toBeNull()
    expect(pickMailbox([box({ email: null })])).toBeNull()
    expect(pickMailbox([])).toBeNull()
  })
})
