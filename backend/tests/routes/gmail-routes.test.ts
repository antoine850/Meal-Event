import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const read = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../src', p), 'utf-8')

describe('gmail routes wiring', () => {
  const routes = read('routes/gmail.ts')
  const index = read('index.ts')

  it('expose les 4 routes', () => {
    expect(routes).toContain("gmailRouter.get('/auth-url'")
    expect(routes).toContain("gmailRouter.get('/status'")
    expect(routes).toContain("gmailRouter.delete('/disconnect'")
    expect(routes).toContain("gmailPublicRouter.get('/callback'")
  })

  it('gate auth-url derriere GMAIL_INTEGRATION_ENABLED', () => {
    expect(routes).toContain('GMAIL_INTEGRATION_ENABLED')
  })

  it('monte le callback public avant le router authentifie', () => {
    const pub = index.indexOf("app.use('/api/gmail', gmailPublicRouter)")
    const auth = index.indexOf("app.use('/api/gmail', requireAuth, gmailRouter)")
    expect(pub).toBeGreaterThan(-1)
    expect(auth).toBeGreaterThan(-1)
    expect(pub).toBeLessThan(auth)
  })
})
