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

  it('gate auth-url et callback derriere le master switch', () => {
    const lib = read('lib/gmail.ts')
    expect(lib).toContain('GMAIL_INTEGRATION_ENABLED')
    // auth-url et callback utilisent le helper centralise.
    const authUrlIdx = routes.indexOf("'/auth-url'")
    const callbackIdx = routes.indexOf("'/callback'")
    expect(routes.indexOf('isGmailIntegrationEnabled', authUrlIdx)).toBeGreaterThan(authUrlIdx)
    expect(routes.indexOf('isGmailIntegrationEnabled', callbackIdx)).toBeGreaterThan(callbackIdx)
  })

  it('monte le callback public avant le router authentifie', () => {
    const pub = index.indexOf("app.use('/api/gmail', gmailPublicRouter)")
    const auth = index.indexOf("app.use('/api/gmail', requireAuth, gmailRouter)")
    expect(pub).toBeGreaterThan(-1)
    expect(auth).toBeGreaterThan(-1)
    expect(pub).toBeLessThan(auth)
  })
})
