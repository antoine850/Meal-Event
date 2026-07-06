import { supabase } from './supabase.js'

export interface MailboxCandidate {
  userId: string | null
  email: string | null
  connected: boolean
  sendingEnabled: boolean
}

// 1re boite connectee ET pilote (sending_enabled). Pure : decision seule.
export function pickMailbox(
  candidates: MailboxCandidate[]
): { userId: string; email: string } | null {
  for (const c of candidates) {
    if (c.userId && c.email && c.connected && c.sendingEnabled) {
      return { userId: c.userId, email: c.email }
    }
  }
  return null
}
