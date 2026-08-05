# Gmail : ouverture à toute l'équipe + signature personnelle -- Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toute personne qui connecte sa boîte Gmail envoie depuis celle-ci sans intervention en base, et chacun règle une signature personnelle qui remplace le « Cordialement, {Prénom Nom} » sur tous les emails client.

**Architecture:** Les gabarits ne connaissent pas la boîte d'expédition (choisie plus tard). Ils posent donc un bloc signature encadré de marqueurs HTML contenant le repli actuel ; `sendClientEmail`, passage obligé de tous les emails client et qui vient de résoudre la boîte, remplace ce bloc par la signature du vrai expéditeur. Signature vide = bloc de repli intact = email identique à aujourd'hui.

**Tech Stack:** Express 4 + TypeScript (backend), vitest, Supabase (PostgreSQL, service-role côté backend), React 19 + TanStack Query + shadcn/ui (front), DOMPurify.

**Spec:** [docs/superpowers/specs/2026-08-05-gmail-signature-et-generalisation-design.md](../specs/2026-08-05-gmail-signature-et-generalisation-design.md)

---

## Structure des fichiers

**Créés :**
- `supabase/migrations/20260805_gmail_signature.sql` -- défaut du flag par boîte + colonne `email_signature`.
- `backend/src/lib/email-signature.ts` -- module **pur** : marqueurs, échappement, bloc de repli, rendu du texte utilisateur, substitution. Aucune dépendance DB, donc entièrement testable.
- `backend/tests/lib/email-signature.test.ts` -- tests du module pur.
- `src/features/settings/hooks/use-email-signature.ts` -- query + mutation.
- `src/features/settings/integrations/components/email-signature-settings.tsx` -- carte de réglage.

**Modifiés :**
- `backend/src/lib/email-templates.ts` -- 6 gabarits client passent par `signatureBlock`.
- `backend/src/lib/client-email.ts` -- résolution du signataire + substitution avant tout usage du HTML.
- `backend/src/routes/emails.ts` -- composer libre sur le même mécanisme, `esc` importé, routes `GET`/`PUT /api/emails/signature`.
- `backend/tests/routes/client-email-callsites.test.ts` -- verrous ajoutés.
- `src/features/settings/integrations/page.tsx` -- carte ajoutée.
- `src/features/emails/components/booking-emails-tab.tsx` -- zone de réponse réservée aux boîtes connectées.
- `src/features/contacts/components/contact-detail-page.tsx` -- bouton « Envoyer un email » idem.

**Pas touché :** `src/lib/supabase/types.ts` (le front ne lit jamais `users.email_signature` directement, tout passe par les routes backend), les deux gabarits de notification interne (`buildSignatureNotificationHtml`, `buildPaymentNotificationHtml`) qui s'adressent au commercial et non au client.

---

## Task 1 : Migration SQL

**Files:**
- Create: `supabase/migrations/20260805_gmail_signature.sql`

- [ ] **Step 1: Écrire la migration**

Migration idempotente (convention du repo : elle peut être rejouée sans casser).

```sql
-- Fin du pilote Gmail : une boite fraichement connectee envoie desormais
-- reellement depuis Gmail. La colonne reste comme coupe-circuit par boite
-- (repasser a false a la main si une boite deraille).
ALTER TABLE user_gmail_accounts ALTER COLUMN sending_enabled SET DEFAULT true;
UPDATE user_gmail_accounts SET sending_enabled = true WHERE sending_enabled = false;

-- Signature email personnelle, attachee a la personne (survit a une
-- deconnexion Gmail, sert aussi aux envois Resend).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature TEXT;
```

- [ ] **Step 2: Vérifier qu'aucune autre migration ne porte ce nom**

Run: `ls supabase/migrations/ | grep 20260805`
Expected: une seule ligne, `20260805_gmail_signature.sql`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260805_gmail_signature.sql
git commit -m "feat(emails): migration signature perso et envoi gmail ouvert"
```

**Ne pas appliquer en prod maintenant** : la migration se colle dans l'éditeur SQL Supabase au moment du déploiement (Task 9).

---

## Task 2 : Module pur `email-signature.ts`

**Files:**
- Create: `backend/src/lib/email-signature.ts`
- Test: `backend/tests/lib/email-signature.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, it, expect } from 'vitest'
import {
  applySignature,
  esc,
  renderSignature,
  signatureBlock,
} from '../../src/lib/email-signature.js'

describe('signatureBlock (bloc de repli balise)', () => {
  it('reprend le markup du nom actuel, encadre des marqueurs', () => {
    expect(signatureBlock('Victor Lionnet')).toBe(
      '<!--mev:sig--><p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">Victor Lionnet</p><!--/mev:sig-->'
    )
  })

  it('echappe le nom de repli', () => {
    expect(signatureBlock('Bistrot & Co')).toContain('Bistrot &amp; Co')
  })
})

describe('applySignature (substitution a l envoi)', () => {
  const html = `<div>Bonjour</div>${signatureBlock('Victor Lionnet')}`

  it('signature absente ou vide : HTML inchange', () => {
    expect(applySignature(html, null)).toBe(html)
    expect(applySignature(html, '   ')).toBe(html)
  })

  it('pas de marqueurs : HTML inchange', () => {
    expect(applySignature('<div>Bonjour</div>', 'Camille')).toBe(
      '<div>Bonjour</div>'
    )
  })

  it('remplace le bloc entier, marqueurs compris', () => {
    const out = applySignature(html, 'Camille Michoudet')
    expect(out).toContain('Camille Michoudet')
    expect(out).not.toContain('Victor Lionnet')
    expect(out).not.toContain('mev:sig')
    expect(out.startsWith('<div>Bonjour</div>')).toBe(true)
  })

  it('une signature contenant $& n est pas interpretee', () => {
    expect(applySignature(html, 'Promo $& co')).toContain('Promo $&amp; co')
  })
})

describe('renderSignature (texte utilisateur -> HTML)', () => {
  it('echappe le HTML utilisateur', () => {
    expect(renderSignature('<script>alert(1)</script>')).toContain(
      '&lt;script&gt;'
    )
    expect(renderSignature('<script>alert(1)</script>')).not.toContain(
      '<script>'
    )
  })

  it('un retour a la ligne devient un <br/>', () => {
    expect(renderSignature('Victor Lionnet\nChef de projet')).toContain(
      'Victor Lionnet<br/>Chef de projet'
    )
  })

  it('rend le site cliquable', () => {
    expect(renderSignature('https://pasparisiens.com')).toContain(
      '<a href="https://pasparisiens.com"'
    )
    expect(renderSignature('www.pasparisiens.com')).toContain(
      '<a href="https://www.pasparisiens.com"'
    )
  })

  it('rend l email cliquable', () => {
    expect(renderSignature('victor.l@pasparisiens.com')).toContain(
      '<a href="mailto:victor.l@pasparisiens.com"'
    )
  })

  it('rend le telephone cliquable, sans separateurs dans le lien', () => {
    expect(renderSignature('06 12 34 56 78')).toContain(
      '<a href="tel:0612345678"'
    )
    expect(renderSignature('+33 6 12 34 56 78')).toContain(
      '<a href="tel:+33612345678"'
    )
  })

  it('pas de lien dans un lien', () => {
    const out = renderSignature('Ecrivez a victor.l@pasparisiens.com')
    expect(out.match(/<a /g)?.length).toBe(1)
  })

  it('un numero ne traverse pas deux lignes', () => {
    const out = renderSignature('06 12 34 56 78\n01 02 03 04 05')
    expect(out.match(/<a /g)?.length).toBe(2)
  })
})

describe('esc', () => {
  it('echappe &, < et >', () => {
    expect(esc('a & <b>')).toBe('a &amp; &lt;b&gt;')
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && pnpm vitest run tests/lib/email-signature.test.ts`
Expected: FAIL -- `Failed to resolve import "../../src/lib/email-signature.js"`

- [ ] **Step 3: Écrire le module**

```ts
// Bloc signature des emails client. Les gabarits posent le bloc de repli (nom
// du commercial), sendClientEmail le remplace par la signature de la personne
// dont la boite envoie reellement : les gabarits ne connaissent pas encore
// l'expediteur au moment ou ils sont rendus.
const SIG_OPEN = '<!--mev:sig-->'
const SIG_CLOSE = '<!--/mev:sig-->'
const SIG_RE = /<!--mev:sig-->[\s\S]*?<!--\/mev:sig-->/g

// Sites, emails et telephones en une seule passe : des passes successives
// re-linkifieraient le contenu des href deja produits.
const LINKIFY =
  /(https?:\/\/[^\s<]+|www\.[^\s<]+|[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+33|0)[\d\s.-]{8,}\d)/g

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function signatureBlock(fallbackName: string): string {
  return `${SIG_OPEN}<p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">${esc(fallbackName)}</p>${SIG_CLOSE}`
}

function linkifyLine(line: string): string {
  return line.replace(LINKIFY, (m) => {
    if (/^https?:\/\//i.test(m)) return `<a href="${m}" style="color:#0d7377;">${m}</a>`
    if (/^www\./i.test(m)) return `<a href="https://${m}" style="color:#0d7377;">${m}</a>`
    if (m.includes('@')) return `<a href="mailto:${m}" style="color:#0d7377;">${m}</a>`
    return `<a href="tel:${m.replace(/[\s.-]/g, '')}" style="color:#444;text-decoration:none;">${m}</a>`
  })
}

// Linkification ligne par ligne : \s dans le motif telephone traverserait
// sinon un retour a la ligne et collerait deux numeros en un seul lien.
export function renderSignature(raw: string): string {
  const lines = esc(raw.trim()).split(/\r?\n/).map(linkifyLine)
  return `<p style="margin:0;font-size:14px;line-height:1.6;color:#444;">${lines.join('<br/>')}</p>`
}

// Remplacement par fonction : une signature contenant $& ou $' serait sinon
// interpretee comme motif de remplacement par String.replace.
export function applySignature(html: string, raw: string | null): string {
  if (!raw || !raw.trim()) return html
  const rendered = renderSignature(raw)
  return html.replace(SIG_RE, () => rendered)
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd backend && pnpm vitest run tests/lib/email-signature.test.ts`
Expected: PASS, 14 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/email-signature.ts backend/tests/lib/email-signature.test.ts
git commit -m "feat(emails): module de rendu des signatures"
```

---

## Task 3 : Brancher les 6 gabarits client

**Files:**
- Modify: `backend/src/lib/email-templates.ts` (lignes 203-208, 333-338, 448-453, 570-575, 837, 876)
- Test: `backend/tests/routes/client-email-callsites.test.ts`

Le `<p>Cordialement,</p>` **reste dans le gabarit** : seul le `<p>` du nom devient le bloc balisé. Une signature personnelle remplace donc le nom, pas la formule de politesse.

- [ ] **Step 1: Écrire les verrous qui échouent**

Ajouter à la fin de `backend/tests/routes/client-email-callsites.test.ts` :

```ts
// Verrou signature (spec du 05/08) : le nom de l'expediteur n'est plus code en
// dur dans les gabarits, il passe par le bloc balise que sendClientEmail
// substitue. Un gabarit qui reviendrait au nom en dur enverrait la signature
// d'une autre personne que la boite expeditrice.
describe('signature des emails client', () => {
  it('aucun gabarit ne code le nom du commercial en dur', () => {
    expect(read('lib/email-templates.ts')).not.toContain(
      '${commercialName || restaurant.name}'
    )
  })

  it('les 6 gabarits client passent par signatureBlock', () => {
    const calls = read('lib/email-templates.ts').match(/signatureBlock\(/g)
    expect(calls?.length).toBe(6)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && pnpm vitest run tests/routes/client-email-callsites.test.ts`
Expected: FAIL -- les deux nouveaux tests échouent (nom encore en dur, 0 appel à `signatureBlock`)

- [ ] **Step 3: Importer le module dans les gabarits**

En tête de `backend/src/lib/email-templates.ts`, ajouter l'import à la suite des imports existants :

```ts
import { signatureBlock } from './email-signature.js'
```

- [ ] **Step 4: Remplacer la forme multi-lignes (4 occurrences : devis, acompte, solde, lien de paiement)**

Remplacer **toutes** les occurrences de ce bloc :

```
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">
      ${commercialName || restaurant.name}
    </p>
```

par :

```
    ${signatureBlock(commercialName || restaurant.name)}
```

- [ ] **Step 5: Remplacer la forme sur une ligne (2 occurrences : relance, avoir)**

Remplacer **toutes** les occurrences de cette ligne :

```
    <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">${commercialName || restaurant.name}</p>
```

par :

```
    ${signatureBlock(commercialName || restaurant.name)}
```

- [ ] **Step 6: Lancer les tests et la compilation**

Run: `cd backend && pnpm vitest run tests/routes/client-email-callsites.test.ts && pnpm build`
Expected: PASS, `tsc` sans erreur

- [ ] **Step 7: Relire le diff en ignorant les espaces**

Run: `git diff -w backend/src/lib/email-templates.ts`
Expected: 6 blocs remplacés + 1 import. Le hook Prettier reformate tout le fichier à l'enregistrement, `-w` isole le vrai changement.

- [ ] **Step 8: Commit**

```bash
git add backend/src/lib/email-templates.ts backend/tests/routes/client-email-callsites.test.ts
git commit -m "feat(emails): bloc signature balise dans les gabarits client"
```

---

## Task 4 : Substituer la signature à l'envoi

**Files:**
- Modify: `backend/src/lib/client-email.ts` (import, helper, corps de `sendClientEmail`)
- Test: `backend/tests/routes/client-email-callsites.test.ts`

- [ ] **Step 1: Écrire le verrou qui échoue**

Ajouter dans le `describe('signature des emails client', ...)` de `backend/tests/routes/client-email-callsites.test.ts` :

```ts
  it('client-email.ts substitue la signature avant tout usage du HTML', () => {
    const src = read('lib/client-email.ts')
    expect(src).toContain('applySignature(params.html')
    // params.html ne doit plus etre lu ailleurs : l'envoi Gmail, l'envoi
    // Resend et les deux recordOutbound utilisent le HTML substitue.
    expect(src.match(/params\.html/g)?.length).toBe(1)
  })
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && pnpm vitest run tests/routes/client-email-callsites.test.ts`
Expected: FAIL -- `applySignature` absent, 4 occurrences de `params.html`

- [ ] **Step 3: Ajouter l'import et le helper de lecture**

Dans `backend/src/lib/client-email.ts`, ajouter l'import après les autres imports de `lib` :

```ts
import { applySignature } from './email-signature.js'
```

et le helper juste après `getCommercialInfo` (vers la ligne 60) :

```ts
// Signature personnelle d'un utilisateur (vide = le bloc de repli du gabarit
// reste en place).
async function loadSignature(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('email_signature')
    .eq('id', userId)
    .single()
  return (data as any)?.email_signature ?? null
}
```

- [ ] **Step 4: Résoudre le signataire et substituer**

Dans `sendClientEmail`, juste après la résolution de la boîte (`const mailbox = await resolveSenderMailbox({...})`, vers la ligne 158-161), insérer :

```ts
  // Signataire = la boite qui envoie vraiment, sinon la personne qui a clique.
  // Sans l'un ni l'autre, le bloc de repli du gabarit (commercial attribue)
  // reste en place. Substitution faite ici, avant l'envoi ET avant
  // l'archivage : le corps stocke dans email_messages porte la vraie signature.
  const signerUserId = mailbox?.userId ?? params.actorUserId ?? null
  const signature = signerUserId ? await loadSignature(signerUserId) : null
  const html = applySignature(params.html, signature)
```

`applySignature` renvoie le HTML tel quel quand la signature est nulle : pas besoin de brancher ici, et `params.html` n'est lu qu'une seule fois dans tout le fichier (ce que verrouille le test du Step 1).

- [ ] **Step 5: Utiliser `html` partout à la place de `params.html`**

Quatre endroits, tous situés après l'insertion du Step 4 :

1. dans `persistGmail`, l'appel à `recordOutbound` : `html: params.html,` -> `html,`
2. dans `buildRawMessage` : `html: params.html,` -> `html,`
3. dans l'appel à `sendEmail` (chemin Resend) : `html: params.html,` -> `html,`
4. dans le `recordOutbound` du chemin Resend : `html: params.html,` -> `html,`

- [ ] **Step 6: Lancer les tests et la compilation**

Run: `cd backend && pnpm test && pnpm build`
Expected: tous les tests PASS, `tsc` sans erreur

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/client-email.ts backend/tests/routes/client-email-callsites.test.ts
git commit -m "feat(emails): signature de la boite qui envoie vraiment"
```

---

## Task 5 : Emails libres sur le même mécanisme

**Files:**
- Modify: `backend/src/routes/emails.ts` (lignes 7-15, 33, 146, 238)

Aujourd'hui le composer construit son HTML avec `signatureOf(actor)` = l'acteur, alors que l'email peut partir de la boîte du commercial attribué si l'acteur n'est pas connecté. Il passe donc au même bloc balisé.

**Changement visible assumé :** sur ces emails libres, le nom passe en gras (markup commun avec les gabarits). C'est le seul écart de rendu quand personne n'a rempli de signature.

- [ ] **Step 1: Remplacer l'échappement local par l'import**

Dans `backend/src/routes/emails.ts`, supprimer :

```ts
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
```

et ajouter après l'import de `sendClientEmail` :

```ts
import { esc, signatureBlock } from '../lib/email-signature.js'
```

- [ ] **Step 2: Poser le bloc balisé dans `buildPlainHtml`**

Remplacer :

```ts
// Email personnel brut (decision 08/07) : texte echappe (nl2br) + signature.
function buildPlainHtml(message: string, signature: string): string {
  const body = esc(message.trim()).replace(/\n/g, '<br/>')
  const sig = signature ? `<br/><br/>${esc(signature)}` : ''
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${body}${sig}</div>`
}
```

par :

```ts
// Email personnel brut (decision 08/07) : texte echappe (nl2br) + bloc
// signature balise, que sendClientEmail remplace par la signature de la boite
// expeditrice.
function buildPlainHtml(message: string, signature: string): string {
  const body = esc(message.trim()).replace(/\n/g, '<br/>')
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${body}<br/><br/>${signature}</div>`
}
```

- [ ] **Step 3: Faire produire le bloc par `signatureOf`**

Remplacer :

```ts
const signatureOf = (a: Actor) => `${a.first_name} ${a.last_name}`
```

par :

```ts
const signatureOf = (a: Actor) =>
  signatureBlock(`${a.first_name} ${a.last_name}`)
```

Les deux appels existants (`/reply` ligne ~146 et `/send` ligne ~238) restent inchangés.

- [ ] **Step 4: Vérifier les tests et la compilation**

Run: `cd backend && pnpm test && pnpm build`
Expected: tous les tests PASS, `tsc` sans erreur

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/emails.ts
git commit -m "feat(emails): composer libre sur le bloc signature"
```

---

## Task 6 : Routes de réglage de la signature

**Files:**
- Modify: `backend/src/routes/emails.ts` (nouvelles routes en fin de fichier)

- [ ] **Step 1: Compléter l'import**

Passer l'import du Step 1 de la Task 5 à :

```ts
import { esc, renderSignature, signatureBlock } from '../lib/email-signature.js'
```

- [ ] **Step 2: Ajouter les deux routes en fin de fichier**

```ts
// Signature personnelle de l'utilisateur courant. preview_html est rendu ici
// (et pas cote front) pour que l'apercu des reglages soit exactement ce que
// recevra le client, sans dupliquer le rendu.
const MAX_SIGNATURE_CHARS = 2000

emailsRouter.get('/signature', async (req: Request, res: Response) => {
  try {
    const actorUserId = (req as any).user?.id as string | undefined
    if (!actorUserId) return res.status(401).json({ error: 'Unauthenticated' })
    const { data } = await supabase
      .from('users')
      .select('email_signature')
      .eq('id', actorUserId)
      .single()
    const signature = ((data as any)?.email_signature as string | null) ?? null
    return res.json({
      signature,
      preview_html: signature ? renderSignature(signature) : '',
    })
  } catch (error) {
    console.error('[emails] get signature error:', error)
    return res.status(500).json({ error: 'Échec' })
  }
})

emailsRouter.put('/signature', async (req: Request, res: Response) => {
  try {
    const actorUserId = (req as any).user?.id as string | undefined
    if (!actorUserId) return res.status(401).json({ error: 'Unauthenticated' })
    const { signature } = req.body as { signature?: unknown }
    if (signature != null && typeof signature !== 'string') {
      return res.status(400).json({ error: 'signature invalide' })
    }
    const value = typeof signature === 'string' ? signature.trim() : ''
    if (value.length > MAX_SIGNATURE_CHARS) {
      return res
        .status(400)
        .json({ error: `Signature : ${MAX_SIGNATURE_CHARS} caractères maximum` })
    }
    const { error } = await supabase
      .from('users')
      .update({ email_signature: value || null } as never)
      .eq('id', actorUserId)
    if (error) {
      console.error('[emails] put signature error:', error)
      return res.status(500).json({ error: 'Échec' })
    }
    return res.json({
      signature: value || null,
      preview_html: value ? renderSignature(value) : '',
    })
  } catch (error) {
    console.error('[emails] put signature error:', error)
    return res.status(500).json({ error: 'Échec' })
  }
})
```

- [ ] **Step 3: Vérifier la compilation et les tests**

Run: `cd backend && pnpm build && pnpm test`
Expected: `tsc` sans erreur, tous les tests PASS

- [ ] **Step 4: Vérifier que la route est bien derrière l'auth**

Lancer `cd backend && pnpm dev` dans un terminal, puis dans un autre :

```bash
curl -s -X PUT http://localhost:3001/api/emails/signature -H 'Content-Type: application/json' -d '{"signature":"x"}'
```

Expected: une erreur d'authentification, pas un succès. Arrêter `pnpm dev` ensuite.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/emails.ts
git commit -m "feat(emails): routes de reglage de la signature"
```

---

## Task 7 : Carte de réglage dans le front

**Files:**
- Create: `src/features/settings/hooks/use-email-signature.ts`
- Create: `src/features/settings/integrations/components/email-signature-settings.tsx`
- Modify: `src/features/settings/integrations/page.tsx`

- [ ] **Step 1: Créer le hook**

`src/features/settings/hooks/use-email-signature.ts` :

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

type EmailSignature = {
  signature: string | null
  preview_html: string
}

export function useEmailSignature() {
  return useQuery({
    queryKey: ['email-signature'],
    queryFn: () => apiClient<EmailSignature>('/api/emails/signature'),
  })
}

export function useUpdateEmailSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (signature: string) =>
      apiClient<EmailSignature>('/api/emails/signature', {
        method: 'PUT',
        body: { signature },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['email-signature'], data)
    },
  })
}
```

- [ ] **Step 2: Créer la carte**

`src/features/settings/integrations/components/email-signature-settings.tsx`. L'aperçu suit le pattern déjà en place dans `src/features/emails/components/email-thread-view.tsx:26` : nettoyage DOMPurify avant injection.

```tsx
import { useState } from 'react'
import DOMPurify from 'dompurify'
import { Loader2, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  useEmailSignature,
  useUpdateEmailSignature,
} from '../../hooks/use-email-signature'

const PLACEHOLDER = `Victor Lionnet
Chargé de projets événementiels
06 12 34 56 78
www.pasparisiens.com`

export function EmailSignatureSettings() {
  const { data, isLoading } = useEmailSignature()
  const { mutateAsync: save, isPending } = useUpdateEmailSignature()
  const [draft, setDraft] = useState<string | null>(null)

  const current = data?.signature ?? ''
  const value = draft ?? current
  const dirty = value !== current

  const handleSave = async () => {
    try {
      await save(value)
      setDraft(null)
      toast.success('Signature enregistrée.')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'enregistrement."
      )
    }
  }

  const previewHtml = DOMPurify.sanitize(data?.preview_html ?? '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style'],
  })

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <PenLine className='h-5 w-5' />
          <CardTitle>Signature email</CardTitle>
        </div>
        <CardDescription>
          Elle remplace votre nom au bas de tous les emails que vous envoyez
          depuis le CRM : devis, factures, relances et messages libres.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {isLoading ? (
          <div className='flex items-center justify-center py-6'>
            <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <>
            <Textarea
              rows={6}
              value={value}
              placeholder={PLACEHOLDER}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>
              Laissez vide pour signer de votre prénom et nom. Sites, adresses
              email et numéros de téléphone deviennent cliquables.
            </p>

            {previewHtml && (
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Aperçu {dirty && '(enregistrez pour le mettre à jour)'}
                </p>
                <div
                  className='rounded-md border bg-muted/30 p-3'
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}

            <Button onClick={handleSave} disabled={!dirty || isPending}>
              {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Enregistrer
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Ajouter la carte à la page**

Remplacer le corps de `src/features/settings/integrations/page.tsx` :

```tsx
import { Main } from '@/components/layout/main'
import { EmailSignatureSettings } from './components/email-signature-settings'
import { GmailSettings } from './components/gmail-settings'

export function IntegrationsPage() {
  return (
    <Main>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>Intégrations</h1>
        <p className='text-muted-foreground'>
          Connectez vos outils personnels au CRM.
        </p>
      </div>
      <div className='mt-6 max-w-2xl space-y-6'>
        <GmailSettings />
        <EmailSignatureSettings />
      </div>
    </Main>
  )
}
```

- [ ] **Step 4: Vérifier la compilation**

Run: `pnpm build`
Expected: `tsc` puis `vite build` sans erreur

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/hooks/use-email-signature.ts src/features/settings/integrations/
git commit -m "feat(emails): carte de reglage de la signature"
```

---

## Task 8 : Réserver les zones d'envoi aux boîtes connectées

**Files:**
- Modify: `src/features/emails/components/booking-emails-tab.tsx:91-95`
- Modify: `src/features/contacts/components/contact-detail-page.tsx:117`

Sans boîte connectée, un envoi part de `noreply@` hors du fil : le client répond dans le vide et la réponse ne revient jamais dans le CRM. Le menu « Envoyer un email » de la liste applique déjà cette règle (`send-email-menu.tsx:141-142`).

- [ ] **Step 1: Zone de réponse du fil**

Dans `src/features/emails/components/booking-emails-tab.tsx`, ajouter l'import du routeur en tête de fichier :

```tsx
import { Link } from '@tanstack/react-router'
```

puis remplacer :

```tsx
          {/* Zone de reponse : uniquement quand l'integration Gmail est active
              (les reponses clients ne remontent pas sans polling). */}
          {gmailStatus?.integration_enabled && (
            <EmailReplyComposer bookingId={bookingId} />
          )}
```

par :

```tsx
          {/* Zone de reponse : uniquement pour une boite connectee. Sans boite,
              l'envoi partirait de noreply@ hors du fil et la reponse du client
              ne reviendrait jamais dans le CRM. */}
          {gmailStatus?.integration_enabled &&
            (gmailStatus.connected ? (
              <EmailReplyComposer bookingId={bookingId} />
            ) : (
              <p className='text-sm text-muted-foreground'>
                <Link
                  to='/settings/integrations'
                  className='underline underline-offset-4'
                >
                  Connectez votre Gmail
                </Link>{' '}
                pour répondre depuis votre adresse.
              </p>
            ))}
```

- [ ] **Step 2: Bouton de la fiche contact**

Dans `src/features/contacts/components/contact-detail-page.tsx`, remplacer :

```tsx
          {gmailStatus?.integration_enabled && contact.email && (
```

par :

```tsx
          {gmailStatus?.integration_enabled &&
            gmailStatus.connected &&
            contact.email && (
```

Vérifier que les parenthèses du bloc JSX restent équilibrées après le reformatage Prettier.

- [ ] **Step 3: Vérifier la compilation**

Run: `pnpm build`
Expected: `tsc` puis `vite build` sans erreur

- [ ] **Step 4: Commit**

```bash
git add src/features/emails/components/booking-emails-tab.tsx src/features/contacts/components/contact-detail-page.tsx
git commit -m "fix(emails): zones d envoi reservees aux boites connectees"
```

---

## Task 9 : Vérification finale et déploiement

**Files:**
- Test: `backend/tests/lib/email-signature-integration.test.ts` (créé puis conservé)

- [ ] **Step 1: Prouver qu'une signature vide ne change pas un email**

Créer `backend/tests/lib/email-signature-integration.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { applySignature } from '../../src/lib/email-signature.js'
import { buildReminderEmailHtml } from '../../src/lib/email-templates.js'

// RestaurantBranding n'exige que `name`, ContactInfo que `first_name` :
// ces litteraux suffisent au typage.
const html = buildReminderEmailHtml({
  restaurant: { name: 'Sapristi', color: '#0d7377' },
  contact: { first_name: 'Jean', last_name: 'Dupont' },
  message: 'Bonjour, pensez au solde.',
  commercialName: 'Victor Lionnet',
})

describe('gabarit reel + substitution', () => {
  it('signature vide : le nom du commercial reste en place', () => {
    const out = applySignature(html, null)
    expect(out).toContain('>Victor Lionnet</p>')
    expect(out).toContain('Cordialement,')
  })

  it('signature renseignee : elle remplace le nom, la politesse reste', () => {
    const out = applySignature(html, 'Camille Michoudet\n06 12 34 56 78')
    expect(out).toContain('Camille Michoudet')
    expect(out).not.toContain('Victor Lionnet')
    expect(out).toContain('Cordialement,')
    expect(out).toContain('tel:0612345678')
    expect(out).not.toContain('mev:sig')
  })
})
```

- [ ] **Step 2: Lancer ce test**

Run: `cd backend && pnpm vitest run tests/lib/email-signature-integration.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 3: Suite complète backend**

Run: `cd backend && pnpm test && pnpm build`
Expected: tous les tests PASS (les ~140 existants + les nouveaux), `tsc` sans erreur

- [ ] **Step 4: Build front**

Run: `pnpm build`
Expected: sans erreur

- [ ] **Step 5: Relire le diff complet**

Run: `git diff main --stat` puis `git diff -w main -- backend/src/lib/email-templates.ts`
Expected: aucune modification hors périmètre ; le reformatage Prettier de `email-templates.ts` est du bruit connu.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/lib/email-signature-integration.test.ts
git commit -m "test(emails): rendu reel d un gabarit avec signature"
```

- [ ] **Step 7: Séquence de déploiement (Thomas, dans cet ordre)**

1. Coller `supabase/migrations/20260805_gmail_signature.sql` dans l'éditeur SQL de la prod Supabase.
2. Merger sur `main` -> auto-deploy Render (backend) **puis** Netlify (front). Attendre que le backend soit à jour avant le front.
3. Contrôle de non-régression : envoyer un devis de test **sans** signature renseignée, vérifier que l'email reçu est identique à ceux d'avant.
4. Renseigner une signature dans Réglages → Intégrations, renvoyer un devis de test, contrôler le rendu chez le destinataire (liens cliquables, pas de HTML visible).
5. Vérifier que le bouton « Envoyer un email » d'une fiche contact disparaît pour un compte sans Gmail connecté.
6. Prévenir l'équipe : chacun connecte sa boîte (Réglages → Intégrations) puis règle sa signature. Rappel : seules les adresses `@pasparisiens.com` peuvent connecter leur boîte, les autres continuent sur Resend sans rien faire.
7. Surveiller les logs Render aux premiers envois de chaque nouvelle boîte (révocation de token, quota Gmail).

Aucune variable d'environnement à toucher : les trois flags Gmail sont déjà actifs.
