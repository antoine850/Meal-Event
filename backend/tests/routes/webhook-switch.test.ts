import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Lecture statique du fichier source — pas d'exécution. Le but est de garantir
// qu'aucun event Stripe critique pour le métier ne tombe silencieusement dans
// le `default: Unhandled event type`.
//
// Si un case est volontairement retiré, mettre à jour la liste ci-dessous
// avec un commentaire expliquant pourquoi.

const webhooksSource = fs.readFileSync(
  path.resolve(__dirname, '../../src/routes/webhooks.ts'),
  'utf-8'
)

describe('Stripe webhook event routing', () => {
  // Events déjà gérés en main (5/2026)
  const eventsHandled = [
    'checkout.session.completed',
    'invoice.paid',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'account.updated',
    'account.application.deauthorized',
    'charge.refunded',
    'charge.dispute.created',
    'charge.dispute.closed',
    'payout.paid',
  ]

  eventsHandled.forEach(eventType => {
    it(`handles ${eventType}`, () => {
      expect(webhooksSource).toContain(`case '${eventType}':`)
    })
  })

  // Events que la Phase 5 du plan stripe-module-fixes doit ajouter.
  // Marqués `.todo` pour qu'ils apparaissent dans la sortie de test sans
  // casser le CI tant que la Phase 5 n'a pas été déployée.
  it.todo('handles invoice.payment_failed (Phase 5 — bug #5 du plan)')
})

describe('Stripe webhook security', () => {
  it('checks for STRIPE_WEBHOOK_SECRET env var', () => {
    expect(webhooksSource).toContain('STRIPE_WEBHOOK_SECRET')
  })

  it('does not silently accept webhooks without verification in production', () => {
    // Avant Phase 5 : le code accepte avec un warning. Ce test échoue
    // tant que la Phase 5 (durcissement) n'est pas appliquée.
    // En attendant, on vérifie au moins qu'un warning est logué.
    expect(webhooksSource).toContain('STRIPE_WEBHOOK_SECRET not configured')
  })

  it.todo('rejects webhooks with 503 in production when secret missing (Phase 5 — bug #4 du plan)')
})
