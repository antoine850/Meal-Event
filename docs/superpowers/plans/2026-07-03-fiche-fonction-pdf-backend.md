# Fiche de fonction PDF backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Générer le PDF de la fiche de fonction côté backend avec pdfmake (pagination fiable), remplacer l'export client html2pdf.js, et supprimer le code mort associé.

**Architecture:** Nouveau module `backend/src/lib/fiche-fonction-pdf.ts` (fetch booking + doc definition + génération), helper documents partagé extrait de `routes/quotes.ts`, endpoint `POST /api/bookings/:id/fiche-fonction-pdf` qui versionne/uploade/répond `{ fileUrl, fileName, version }`, bouton frontend réduit à un appel `apiClient`. Spec validée : `docs/superpowers/specs/2026-07-03-fiche-fonction-pdf-backend-design.md`.

**Tech Stack:** Express 4, pdfmake 0.2 (Roboto embarquée), Supabase service-role, React Query / apiClient côté frontend.

**Tests :** le repo n'a aucune suite de tests (ni frontend ni backend) — convention projet. La vérification par tâche = compilation (`pnpm build`) + vérification manuelle finale (Task 7). Ne pas introduire de framework de test.

**Conventions :** commits en français style conventionnel sans accents, sujet seul (ex : `fix(pdf): imprime le PU TTC stocke`). Pas de trailer Co-Authored-By. Commentaires de code minimalistes en français.

---

### Task 1: Helper documents partagé (`lib/documents.ts`)

Le helper `savePdfAsDocument` vit dans `backend/src/routes/quotes.ts:58-115` et avale toutes les erreurs (best-effort, voulu pour les flux email où le PDF est régénérable). La fiche de fonction a besoin de la même mécanique mais **stricte** (la ligne `documents` est le livrable) et accessible depuis `routes/bookings.ts`.

**Files:**
- Create: `backend/src/lib/documents.ts`
- Modify: `backend/src/routes/quotes.ts` (supprimer la fonction locale lignes 57-115, ajouter l'import)

- [ ] **Step 1: Créer `backend/src/lib/documents.ts`**

```ts
import { supabase } from './supabase.js'

// Upload d'un PDF vers le bucket Storage 'documents' + insertion d'une ligne
// dans la table documents. Lève en cas d'échec — à utiliser quand la ligne
// documents est le livrable (ex: fiche de fonction).
export async function uploadPdfDocument(
  pdfBuffer: Buffer,
  storagePath: string,
  docName: string,
  organizationId: string | null,
  bookingId: string | null,
  opts?: { doc_kind?: string; credit_note_id?: string }
): Promise<{ storagePath: string; fileUrl: string }> {
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed for ${docName}: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(uploadData?.path || storagePath)

  const fileUrl = urlData?.publicUrl || ''

  const { error: docError } = await supabase.from('documents').insert({
    organization_id: organizationId,
    booking_id: bookingId,
    name: docName,
    file_type: 'pdf',
    file_size: pdfBuffer.length,
    file_path: storagePath,
    file_url: fileUrl,
    ...(opts?.doc_kind ? { doc_kind: opts.doc_kind } : {}),
    ...(opts?.credit_note_id ? { credit_note_id: opts.credit_note_id } : {}),
  } as any)

  if (docError) {
    throw new Error(`Document record insert failed for ${docName}: ${docError.message}`)
  }

  return { storagePath, fileUrl }
}

// Variante best-effort pour les flux email/webhook : le PDF est régénérable,
// un échec de sauvegarde ne doit pas faire échouer l'envoi.
export async function savePdfAsDocument(
  pdfBuffer: Buffer,
  fileName: string,
  storagePath: string,
  docName: string,
  organizationId: string | null,
  bookingId: string | null,
  opts?: { doc_kind?: string; credit_note_id?: string }
) {
  try {
    await uploadPdfDocument(
      pdfBuffer,
      storagePath,
      docName,
      organizationId,
      bookingId,
      opts
    )
    console.log(`[PDF Save] ✅ Saved ${docName} for booking ${bookingId}`)
  } catch (err) {
    console.error(`[PDF Save] Error saving ${fileName}:`, err)
  }
}
```

- [ ] **Step 2: Brancher `routes/quotes.ts` sur le nouveau module**

Dans `backend/src/routes/quotes.ts` :
1. Supprimer la fonction locale `savePdfAsDocument` (le bloc commençant au commentaire `// Helper: save a generated PDF to Supabase Storage and create a document record` ligne 57 jusqu'à la fermeture de la fonction ligne 115).
2. Ajouter l'import (avec les autres imports `../lib/` en tête de fichier) :

```ts
import { savePdfAsDocument } from '../lib/documents.js'
```

Les 4 call sites (`send-email`, `send-deposit`, `send-balance`, création d'avoir) gardent exactement la même signature — aucun autre changement dans ce fichier.

- [ ] **Step 3: Compiler le backend**

Run: `cd backend && pnpm build`
Expected: sortie tsc sans erreur.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/documents.ts backend/src/routes/quotes.ts
git commit -m "refactor(pdf): extrait savePdfAsDocument dans lib/documents"
```

---

### Task 2: Module fiche de fonction — fetch + helpers (`lib/fiche-fonction-pdf.ts`)

Nouveau module dédié (pdf-generator.ts fait déjà 2484 lignes, on n'y ajoute pas 400 lignes de plus). Il duplique volontairement les helpers purs de l'écran (`src/features/reservations/lib/booking-totals.ts` et `fiche-fonction.tsx`) — le backend ne peut pas importer du code frontend, même compromis que les formatters existants. Le rendu buffer est mutualisé via un export ajouté à pdf-generator.ts.

**Files:**
- Create: `backend/src/lib/fiche-fonction-pdf.ts`
- Modify: `backend/src/lib/pdf-generator.ts` (exporter `renderPdfToBuffer`, refactorer les 2 usages internes)

- [ ] **Step 1: Exporter `renderPdfToBuffer` depuis `pdf-generator.ts`**

Dans `backend/src/lib/pdf-generator.ts`, ajouter après la déclaration `const printer = new PdfPrinter(fonts)` (ligne 38) :

```ts
export function renderPdfToBuffer(
  docDefinition: TDocumentDefinitions
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    const chunks: Uint8Array[] = []
    pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}
```

Puis remplacer le corps `return new Promise<Buffer>(...)` identique dans `generateQuotePdf` (lignes 428-435) et `generateCreditNotePdf` (lignes 1976-1983) par :

```ts
  return renderPdfToBuffer(docDefinition)
```

- [ ] **Step 2: Créer `backend/src/lib/fiche-fonction-pdf.ts` — types, fetch, helpers**

```ts
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { renderPdfToBuffer } from './pdf-generator.js'
import { formatEuroAdaptive, formatEuroDecimal } from './quote-rounding.js'
import { supabase } from './supabase.js'

const DASH = '—'

interface FicheQuoteItem {
  id: string
  name: string
  description: string | null
  quantity: number | null
  unit_price: number | null
  unit_price_ttc: number | null
  tva_rate: number | null
  total_ht: number | null
  total_ttc: number | null
}

interface FicheQuote {
  id: string
  quote_number: string | null
  status: string | null
  primary_quote: boolean | null
  total_ttc: number | null
  quote_items: FicheQuoteItem[]
}

interface FichePayment {
  id: string
  amount: number | null
  status: string | null
  payment_modality: string | null
  payment_type: string | null
  quote_id: string | null
}

export interface FicheBookingData {
  id: string
  organization_id: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  guests_count: number | null
  internal_notes: string | null
  mise_en_place: string | null
  deroulement: string | null
  menu_aperitif: string | null
  menu_entree: string | null
  menu_plat: string | null
  menu_dessert: string | null
  menu_boissons: string | null
  allergies_regimes: string | null
  prestations_souhaitees: string | null
  commentaires: string | null
  instructions_speciales: string | null
  contact_sur_place_nom: string | null
  contact_sur_place_tel: string | null
  contact_sur_place_societe: string | null
  source: string | null
  occasion: string | null
  option: string | null
  relance: string | null
  date_signature_devis: string | null
  budget_client: number | null
  assigned_user_ids: string[] | null
  contact: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    company: { name: string | null } | null
  } | null
  restaurant: { id: string; name: string | null; color: string | null } | null
  space: { name: string | null } | null
  quotes: FicheQuote[]
  payments: FichePayment[]
}

export async function fetchBookingFullData(bookingId: string): Promise<{
  booking: FicheBookingData
  assignedNames: string[]
}> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      contact:contacts(id, first_name, last_name, email, phone, company:companies(name)),
      restaurant:restaurants(id, name, color),
      space:spaces(id, name),
      quotes(*, quote_items(*)),
      payments(*)
    `
    )
    .eq('id', bookingId)
    .order('position', { referencedTable: 'quotes.quote_items', ascending: true })
    .single()

  if (error) throw new Error(`Failed to fetch booking: ${error.message}`)
  const booking = data as unknown as FicheBookingData

  const ids = booking.assigned_user_ids || []
  let assignedNames: string[] = []
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', ids)
    assignedNames = (users || [])
      .map((u) => `${u.first_name || ''} ${u.last_name || ''}`.trim())
      .filter(Boolean)
  }

  return { booking, assignedNames }
}

// ── Helpers dupliqués de src/features/reservations/lib/booking-totals.ts ──

function formatBookingId(id: string): string {
  return id.replace(/-/g, '').slice(-10).toUpperCase()
}

function getActiveQuote(quotes: FicheQuote[]): FicheQuote | null {
  if (!quotes.length) return null
  return (
    quotes.find((q) =>
      ['deposit_paid', 'balance_sent', 'balance_paid', 'completed'].includes(
        q.status || ''
      )
    ) ||
    quotes.find((q) => q.status === 'quote_signed') ||
    quotes.find((q) => q.status === 'deposit_sent') ||
    quotes.find((q) => q.primary_quote) ||
    quotes[0] ||
    null
  )
}

function computeVatBreakdown(items: FicheQuoteItem[]) {
  let totalHt = 0
  let totalTtc = 0
  let vat10 = 0
  let vat20 = 0
  for (const item of items) {
    const ht = item.total_ht || 0
    const ttc = item.total_ttc || 0
    totalHt += ht
    totalTtc += ttc
    const tva = ttc - ht
    if (item.tva_rate === 10) vat10 += tva
    else if (item.tva_rate === 20) vat20 += tva
  }
  return { totalHt, vat10, vat20, totalTtc }
}

function getRemainingBalance(totalTtc: number, payments: FichePayment[]): number {
  const paid = payments
    .filter((p) => p.status === 'paid' || p.status === 'completed')
    .reduce((s, p) => s + (p.amount || 0), 0)
  return Math.max(0, totalTtc - paid)
}

// ── Formatters (équivalents backend des helpers de fiche-fonction.tsx) ──

function formatDateLong(v: string | null | undefined): string {
  if (!v) return DASH
  try {
    return new Date(v).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(v)
  }
}

function formatHorairesGlobal(
  eventDate: string | null,
  startTime: string | null,
  endTime: string | null
): string {
  if (!eventDate) return DASH
  try {
    const dateStr = new Date(eventDate).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    const start = (startTime || '').slice(0, 5)
    const end = (endTime || '').slice(0, 5)
    if (start && end) return `${dateStr} – ${start}–${end}`
    if (start) return `${dateStr} – ${start}`
    return dateStr
  } catch {
    return String(eventDate)
  }
}
```

- [ ] **Step 3: Compiler le backend**

Run: `cd backend && pnpm build`
Expected: sortie tsc sans erreur (les fonctions pas encore consommées peuvent déclencher noUnusedLocals — si c'est le cas, ce step se valide avec la Task 3 dans le même commit ; vérifier d'abord si `tsconfig` active noUnusedLocals, sinon commit direct).

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/fiche-fonction-pdf.ts backend/src/lib/pdf-generator.ts
git commit -m "feat(fiche): fetch booking et helpers pour le pdf backend"
```

Si le build échoue à cause de fonctions non utilisées (noUnusedLocals), fusionner ce commit avec celui de la Task 3.

---

### Task 3: Doc definition pdfmake (`buildFicheFonctionDocDefinition` + `generateFicheFonctionPdf`)

Le cœur du correctif : la mise en page dédiée avec pagination garantie. Sections dans l'ordre de l'écran (`src/features/reservations/components/fiche-fonction.tsx:328-786`). Règles : `dontBreakRows` + `headerRows: 1` sur les tables d'items (description dans un `stack` de la cellule Titre → solidaire de sa ligne), `unbreakable: true` sur les petits blocs, `pageBreakBefore` + `headlineLevel` contre les titres orphelins, footer paginé.

**Files:**
- Modify: `backend/src/lib/fiche-fonction-pdf.ts` (ajouter à la suite du code de la Task 2)

- [ ] **Step 1: Ajouter les builders de sections**

Ajouter à la fin de `backend/src/lib/fiche-fonction-pdf.ts` :

```ts
// ── Builders de sections ──

const GRAY = '#6b7280'
const LIGHT_GRAY = '#9ca3af'
const BORDER = '#e5e7eb'

const ficheTableLayout = {
  hLineWidth: (i: number, node: any) =>
    i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25,
  vLineWidth: () => 0,
  hLineColor: () => BORDER,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
}

function sectionTitle(text: string, color: string): Content {
  return {
    text: text.toUpperCase(),
    style: 'ficheSectionTitle',
    color,
    headlineLevel: 1,
    margin: [0, 8, 0, 3] as [number, number, number, number],
  }
}

function labelValue(label: string, value: string | null | undefined): Content {
  return {
    stack: [
      { text: label.toUpperCase(), style: 'ficheLabel' },
      { text: value || DASH, style: 'ficheValue' },
    ],
  }
}

// Ligne d'infos en 2-3 colonnes, insécable
function infoRow(cells: Content[]): Content {
  return {
    columns: cells.map((c) => ({ width: '*', ...(c as object) })),
    columnGap: 10,
    unbreakable: true,
    margin: [0, 4, 0, 0] as [number, number, number, number],
  }
}

function headerCell(text: string, color: string, alignment?: 'right'): TableCell {
  return {
    text,
    style: 'ficheTableHeader',
    fillColor: color,
    color: 'white',
    ...(alignment ? { alignment } : {}),
  }
}

function itemsTable(
  title: string,
  items: FicheQuoteItem[],
  color: string
): Content {
  const body: TableCell[][] = [
    [
      headerCell('Titre', color),
      headerCell('Qté', color, 'right'),
      headerCell('TVA', color, 'right'),
      headerCell('Prix U HT', color, 'right'),
      headerCell('Prix U TTC', color, 'right'),
      headerCell('Total HT', color, 'right'),
      headerCell('Total TTC', color, 'right'),
    ],
  ]

  if (items.length === 0) {
    body.push([
      { text: 'Aucune ligne', colSpan: 7, alignment: 'center', color: GRAY },
      {}, {}, {}, {}, {}, {},
    ])
  } else {
    for (const item of items) {
      const tvaRate = item.tva_rate || 0
      // PU TTC stocké en priorité (cf. fix 66803d4), dérivé en secours
      const unitTtc =
        item.unit_price_ttc ?? (item.unit_price || 0) * (1 + tvaRate / 100)
      body.push([
        {
          stack: [
            { text: item.name, bold: true },
            ...(item.description
              ? [{ text: item.description, style: 'ficheDesc' as const, color: GRAY }]
              : []),
          ],
        },
        { text: item.quantity != null ? String(item.quantity) : DASH, alignment: 'right' },
        { text: `${tvaRate.toFixed(2)}%`, alignment: 'right' },
        { text: formatEuroDecimal(item.unit_price || 0), alignment: 'right' },
        { text: formatEuroDecimal(unitTtc), alignment: 'right' },
        { text: formatEuroDecimal(item.total_ht || 0), alignment: 'right' },
        { text: formatEuroDecimal(item.total_ttc || 0), alignment: 'right' },
      ])
    }
  }

  return {
    stack: [
      sectionTitle(title, color),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ['*', 28, 38, 56, 56, 56, 56],
          body,
        },
        layout: ficheTableLayout,
        style: 'ficheTableCell',
      },
    ],
  }
}

// Petite table de montants (Total / Reste / Acomptes), insécable avec son titre
function amountsTable(
  title: string,
  headers: string[],
  rows: TableCell[][],
  color: string
): Content {
  return {
    stack: [
      sectionTitle(title, color),
      {
        table: {
          headerRows: 1,
          widths: headers.map(() => '*'),
          body: [
            headers.map((h, i) =>
              headerCell(h, color, i >= headers.length - 4 ? 'right' : undefined)
            ),
            ...rows,
          ],
        },
        layout: ficheTableLayout,
        style: 'ficheTableCell',
      },
    ],
    unbreakable: true,
  }
}

function textSection(
  title: string,
  text: string | null | undefined,
  color: string
): Content {
  return {
    stack: [
      sectionTitle(title, color),
      { text: text || DASH, style: 'ficheText' },
    ],
  }
}
```

- [ ] **Step 2: Ajouter `buildFicheFonctionDocDefinition`**

Ajouter à la suite :

```ts
export function buildFicheFonctionDocDefinition(
  booking: FicheBookingData,
  assignedNames: string[]
): TDocumentDefinitions {
  const color = booking.restaurant?.color || '#0d7377'
  const bookingRef = formatBookingId(booking.id)
  const now = new Date()
  const printedAt = `${now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`

  const quotes = booking.quotes || []
  const payments = booking.payments || []
  const activeQuote = getActiveQuote(quotes)
  const items = activeQuote?.quote_items || []
  const totals = computeVatBreakdown(items)
  const foodItems = items.filter((i) => i.tva_rate === 10)
  const prestationItems = items.filter((i) => i.tva_rate !== 10)

  const content: Content[] = []

  // ── Bandeau header (même style que les autres documents) ──
  content.push({
    table: {
      widths: ['*', 'auto'],
      body: [
        [
          {
            stack: [
              {
                text: booking.restaurant?.name || 'Restaurant',
                style: 'headerTitle',
                color: 'white',
              },
            ],
            fillColor: color,
            margin: [12, 10, 12, 10] as [number, number, number, number],
          },
          {
            stack: [
              {
                text: `FICHE DE FONCTION n°${bookingRef}`,
                style: 'headerDocTitle',
                color: 'white',
                alignment: 'right' as const,
              },
              {
                text: `Imprimé le ${printedAt}`,
                style: 'headerSmall',
                color: 'white',
                alignment: 'right' as const,
              },
            ],
            fillColor: color,
            margin: [12, 10, 12, 10] as [number, number, number, number],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 10] as [number, number, number, number],
  })

  // ── Horaires ──
  content.push(
    infoRow([
      labelValue(
        'Horaires (Global)',
        formatHorairesGlobal(booking.event_date, booking.start_time, booking.end_time)
      ),
    ])
  )

  // ── Compte / Contact / Coordonnées ──
  const contactName = booking.contact
    ? [booking.contact.first_name, booking.contact.last_name].filter(Boolean).join(' ')
    : ''
  const coordonnees = [booking.contact?.phone, booking.contact?.email]
    .filter(Boolean)
    .join('\n')
  content.push(
    infoRow([
      labelValue('Nom du compte', booking.contact?.company?.name),
      labelValue('Contact', contactName),
      labelValue('Coordonnées', coordonnees),
    ])
  )

  // ── Devis : items / Total / Acomptes / Reste ──
  if (!activeQuote) {
    content.push({
      text: 'Aucun devis associé',
      alignment: 'center',
      color: GRAY,
      margin: [0, 14, 0, 14] as [number, number, number, number],
    })
  } else {
    if (prestationItems.length > 0) {
      content.push(itemsTable('Prestations', prestationItems, color))
    }
    if (foodItems.length > 0) {
      content.push(itemsTable('Food', foodItems, color))
    }
    if (prestationItems.length === 0 && foodItems.length === 0) {
      content.push(itemsTable('Prestations', [], color))
    }

    // Total
    content.push(
      amountsTable(
        'Total',
        ['Total HT', 'TVA 10%', 'TVA 20%', 'Total TTC'],
        [
          [
            { text: formatEuroDecimal(totals.totalHt), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat10), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat20), alignment: 'right' },
            { text: formatEuroDecimal(totals.totalTtc), alignment: 'right', bold: true },
          ],
        ],
        color
      )
    )

    // Acomptes (payés + en attente, prorata HT/TVA par ratio TTC — comme l'écran)
    const allDeposits = payments.filter(
      (p) => p.payment_modality === 'acompte' || p.payment_type === 'deposit'
    )
    const quoteNumberById = new Map<string, string>()
    for (const q of quotes) {
      if (q.id && q.quote_number) quoteNumberById.set(q.id, q.quote_number)
    }
    const depositRows: TableCell[][] =
      allDeposits.length === 0
        ? [[{ text: 'Aucun acompte', colSpan: 6, alignment: 'center', color: GRAY }, {}, {}, {}, {}, {}]]
        : allDeposits.map((p) => {
            const isPaid = p.status === 'paid' || p.status === 'completed'
            const totalRatio =
              (activeQuote.total_ttc || 0) > 0
                ? (p.amount || 0) / (activeQuote.total_ttc || 1)
                : 0
            const quoteNum = p.quote_id
              ? quoteNumberById.get(p.quote_id) || DASH
              : DASH
            return [
              { text: isPaid ? 'Payé' : 'En attente', color: isPaid ? '#15803d' : GRAY },
              { text: quoteNum },
              { text: formatEuroDecimal(totals.totalHt * totalRatio), alignment: 'right' },
              { text: formatEuroDecimal(totals.vat10 * totalRatio), alignment: 'right' },
              { text: formatEuroDecimal(totals.vat20 * totalRatio), alignment: 'right' },
              { text: formatEuroDecimal(p.amount || 0), alignment: 'right', bold: true },
            ]
          })
    content.push(
      amountsTable(
        'Acomptes',
        ['Statut', 'Facture', 'Total HT', 'TVA 10%', 'TVA 20%', 'Total TTC'],
        depositRows,
        color
      )
    )

    // Reste (ventilation TVA au prorata du ratio restant — comme l'écran)
    const remainingTtc =
      activeQuote.total_ttc != null
        ? getRemainingBalance(activeQuote.total_ttc || 0, payments)
        : 0
    const ratio =
      (activeQuote.total_ttc || 0) > 0 ? remainingTtc / (activeQuote.total_ttc || 1) : 0
    content.push(
      amountsTable(
        'Reste',
        ['Total HT', 'TVA 10%', 'TVA 20%', 'Total TTC'],
        [
          [
            { text: formatEuroDecimal(totals.totalHt * ratio), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat10 * ratio), alignment: 'right' },
            { text: formatEuroDecimal(totals.vat20 * ratio), alignment: 'right' },
            { text: formatEuroDecimal(remainingTtc), alignment: 'right', bold: true },
          ],
        ],
        color
      )
    )
  }

  // ── Textes libres ──
  content.push(textSection('Commentaires facturation', booking.internal_notes, color))
  content.push(
    infoRow([
      labelValue('Espace', booking.space?.name),
      labelValue(
        'Nombre de personnes',
        booking.guests_count != null ? String(booking.guests_count) : null
      ),
    ])
  )
  content.push(textSection('Mise en place', booking.mise_en_place, color))
  content.push(textSection('Déroulé', booking.deroulement, color))

  // Menu : 2 colonnes (plats / boissons)
  content.push({
    stack: [
      sectionTitle('Menu', color),
      {
        columns: [
          {
            width: '*',
            stack: [
              labelValue('Apéritif', booking.menu_aperitif),
              labelValue('Entrée', booking.menu_entree),
              labelValue('Plat', booking.menu_plat),
              labelValue('Dessert', booking.menu_dessert),
            ].map((c, i) => ({
              ...(c as object),
              margin: [0, i === 0 ? 0 : 4, 0, 0] as [number, number, number, number],
            })),
          },
          { width: '*', ...(labelValue('Boissons', booking.menu_boissons) as object) },
        ],
        columnGap: 14,
      },
    ],
  })

  content.push(
    infoRow([
      labelValue('Allergies et Régimes', booking.allergies_regimes),
      labelValue('Prestations souhaitées', booking.prestations_souhaitees),
    ])
  )

  // Commentaires combinés (commentaires + instructions spéciales + contact sur place)
  const contactSurPlaceLines: string[] = []
  if (booking.contact_sur_place_nom)
    contactSurPlaceLines.push(`Contact sur place : ${booking.contact_sur_place_nom}`)
  if (booking.contact_sur_place_tel)
    contactSurPlaceLines.push(`Tél : ${booking.contact_sur_place_tel}`)
  if (booking.contact_sur_place_societe)
    contactSurPlaceLines.push(`Société : ${booking.contact_sur_place_societe}`)
  const commentairesBlocks: string[] = []
  if (booking.commentaires) commentairesBlocks.push(booking.commentaires)
  if (booking.instructions_speciales)
    commentairesBlocks.push(`Instructions spéciales :\n${booking.instructions_speciales}`)
  if (contactSurPlaceLines.length > 0)
    commentairesBlocks.push(contactSurPlaceLines.join('\n'))
  content.push(
    textSection('Commentaires', commentairesBlocks.join('\n\n').trim() || null, color)
  )

  // Suivi commercial (2 colonnes, insécable)
  content.push({
    stack: [
      sectionTitle('Suivi commercial', color),
      {
        columns: [
          {
            width: '*',
            stack: [
              labelValue('Commerciaux assignés', assignedNames.join(', ') || null),
              { ...(labelValue('Occasion', booking.occasion) as object), margin: [0, 4, 0, 0] },
              { ...(labelValue('Relance', booking.relance) as object), margin: [0, 4, 0, 0] },
              {
                ...(labelValue(
                  'Budget client',
                  booking.budget_client != null
                    ? formatEuroAdaptive(booking.budget_client)
                    : null
                ) as object),
                margin: [0, 4, 0, 0],
              },
            ],
          },
          {
            width: '*',
            stack: [
              labelValue('Source', booking.source),
              { ...(labelValue('Option', booking.option) as object), margin: [0, 4, 0, 0] },
              {
                ...(labelValue(
                  'Date signature devis',
                  formatDateLong(booking.date_signature_devis)
                ) as object),
                margin: [0, 4, 0, 0],
              },
            ],
          },
        ],
        columnGap: 14,
      },
    ],
    unbreakable: true,
  })

  return {
    content,
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Fiche de fonction n°${bookingRef} — imprimé le ${printedAt}`, style: 'footer' },
        { text: `Page ${currentPage}/${pageCount}`, style: 'footer', alignment: 'right' as const },
      ],
      margin: [30, 8, 30, 0] as [number, number, number, number],
    }),
    // Un titre de section ne reste jamais seul en bas de page
    pageBreakBefore: (currentNode: any, followingNodesOnPage: any[]) =>
      currentNode.headlineLevel === 1 && followingNodesOnPage.length === 0,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      lineHeight: 1.35,
    },
    styles: {
      headerTitle: { fontSize: 14, bold: true },
      headerDocTitle: { fontSize: 10, bold: true },
      headerSmall: { fontSize: 8 },
      ficheSectionTitle: { fontSize: 9, bold: true },
      ficheLabel: { fontSize: 7, bold: true, color: LIGHT_GRAY },
      ficheValue: { fontSize: 9 },
      ficheText: { fontSize: 9 },
      ficheDesc: { fontSize: 8 },
      ficheTableHeader: { fontSize: 8, bold: true },
      ficheTableCell: { fontSize: 8 },
      footer: { fontSize: 7, color: LIGHT_GRAY },
    },
    pageMargins: [30, 30, 30, 50] as [number, number, number, number],
  }
}

export async function generateFicheFonctionPdf(bookingId: string): Promise<{
  buffer: Buffer
  booking: FicheBookingData
}> {
  const { booking, assignedNames } = await fetchBookingFullData(bookingId)
  const docDefinition = buildFicheFonctionDocDefinition(booking, assignedNames)
  const buffer = await renderPdfToBuffer(docDefinition)
  return { buffer, booking }
}
```

- [ ] **Step 3: Compiler le backend**

Run: `cd backend && pnpm build`
Expected: sortie tsc sans erreur. Si des types pdfmake coincent sur `pageBreakBefore` ou `footer` en fonction, caster localement (`as any`) comme le fait déjà le fichier pdf-generator.ts pour PdfPrinter — ne pas désactiver le strict mode.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/fiche-fonction-pdf.ts
git commit -m "feat(fiche): doc definition pdfmake avec pagination fiable"
```

---

### Task 4: Endpoint `POST /api/bookings/:id/fiche-fonction-pdf`

Premier endpoint PDF dans `routes/bookings.ts` (monté avec `requireAuth` dans `index.ts:123`, rien à changer côté montage). Il versionne, génère, uploade en **strict** (la ligne documents est le livrable), et répond en JSON.

**Files:**
- Modify: `backend/src/routes/bookings.ts`

- [ ] **Step 1: Ajouter la route**

En tête de `backend/src/routes/bookings.ts`, compléter les imports :

```ts
import { uploadPdfDocument } from '../lib/documents.js'
import { generateFicheFonctionPdf } from '../lib/fiche-fonction-pdf.js'
```

Puis ajouter à la fin du fichier (après la route `POST /:id/products-services`) :

```ts
// POST /api/bookings/:id/fiche-fonction-pdf
// Génère la fiche de fonction, la versionne (Fiche de fonction vN),
// l'uploade dans Storage + table documents, et renvoie l'URL publique.
bookingsRouter.post('/:id/fiche-fonction-pdf', async (req: Request, res: Response) => {
  try {
    const bookingId = req.params.id

    const { data: existing, error: listError } = await supabase
      .from('documents')
      .select('name')
      .eq('booking_id', bookingId)
      .like('name', 'Fiche de fonction v%')
    if (listError) throw listError

    const maxVersion = (existing || []).reduce<number>((max, d) => {
      const m = ((d as { name: string | null }).name || '').match(
        /^Fiche de fonction v(\d+)$/
      )
      return m ? Math.max(max, parseInt(m[1], 10)) : max
    }, 0)
    const version = maxVersion + 1

    const { buffer, booking } = await generateFicheFonctionPdf(bookingId)

    const fileName = `Fiche-de-fonction-v${version}.pdf`
    const storagePath = `${booking.organization_id}/bookings/${bookingId}/fiche-fonction-v${version}.pdf`
    const { fileUrl } = await uploadPdfDocument(
      buffer,
      storagePath,
      `Fiche de fonction v${version}`,
      booking.organization_id,
      bookingId
    )

    res.json({ fileUrl, fileName, version })
  } catch (error) {
    console.error('Error generating fiche de fonction PDF:', error)
    res.status(500).json({ error: 'Failed to generate fiche de fonction PDF' })
  }
})
```

- [ ] **Step 2: Compiler le backend**

Run: `cd backend && pnpm build`
Expected: sortie tsc sans erreur.

- [ ] **Step 3: Test manuel rapide de l'endpoint (facultatif si pas de token sous la main — la vérif complète est en Task 7)**

Si le backend tourne (`cd backend && pnpm dev`) et qu'un token est disponible :

```bash
curl -s -X POST "http://localhost:3001/api/bookings/<BOOKING_ID>/fiche-fonction-pdf" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Expected: JSON `{"fileUrl":"https://...supabase.co/.../fiche-fonction-v1.pdf","fileName":"Fiche-de-fonction-v1.pdf","version":1}`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/bookings.ts
git commit -m "feat(fiche): endpoint pdf fiche de fonction sur les bookings"
```

---

### Task 5: Frontend — bouton branché sur le backend

Le bouton ne fabrique plus le PDF : il flush la note de facturation en cours d'édition, appelle l'endpoint, télécharge depuis l'URL publique. Le `printRef` disparaît (il ne servait qu'à html2pdf).

**Files:**
- Rewrite: `src/features/reservations/components/fiche-fonction-pdf-button.tsx`
- Modify: `src/features/reservations/components/fiche-fonction.tsx` (props du bouton, flush, suppression du ref)

- [ ] **Step 1: Réécrire `fiche-fonction-pdf-button.tsx`**

Remplacer tout le contenu du fichier par :

```tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

type Props = {
  bookingId: string
  // Sauvegarde la note de facturation en cours d'édition avant génération
  flushNotes: () => Promise<void>
}

export function FicheFonctionPdfButton({ bookingId, flushNotes }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const queryClient = useQueryClient()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await flushNotes()

      const { fileUrl, fileName, version } = await apiClient<{
        fileUrl: string
        fileName: string
        version: number
      }>(`/api/bookings/${bookingId}/fiche-fonction-pdf`, { method: 'POST' })

      // iOS Safari ne supporte pas les blob URL downloads (le fichier s'ouvre dans
      // l'onglet courant plutôt que de se télécharger). On ouvre directement l'URL
      // publique Supabase, qui s'affiche dans l'aperçu PDF natif iOS.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS) {
        window.open(fileUrl, '_blank')
      } else {
        const response = await fetch(fileUrl)
        const blob = await response.blob()
        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // Safari macOS initie les téléchargements de façon asynchrone : révoquer
        // l'URL immédiatement annule le téléchargement avant qu'il démarre.
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 300)
      }

      queryClient.invalidateQueries({ queryKey: ['documents', bookingId] })
      toast.success(`Fiche v${version} enregistrée`)
    } catch (err) {
      console.error('Fiche de fonction PDF export error:', err)
      toast.error("Erreur lors de l'export PDF")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant='default'
      size='sm'
      className='gap-1.5'
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className='h-4 w-4 animate-spin' />
      ) : (
        <Printer className='h-4 w-4' />
      )}
      Imprimer / Enregistrer en PDF
    </Button>
  )
}
```

- [ ] **Step 2: Adapter `fiche-fonction.tsx`**

Quatre retouches dans `src/features/reservations/components/fiche-fonction.tsx` :

1. Ligne 1 : retirer `useRef` de l'import React (devient `import { Fragment, useEffect, useMemo, useState } from 'react'`).
2. Ligne 184 : supprimer `const printRef = useRef<HTMLDivElement>(null)`.
3. Ligne 186 : récupérer aussi `mutateAsync` et ajouter le flush après `saveBillingNotes` :

```ts
  const { mutate: updateBooking, mutateAsync: updateBookingAsync } =
    useUpdateBooking()
```

puis, après la fonction `saveBillingNotes` (ligne 202) :

```ts
  // Version awaitable pour l'export PDF : la note doit être en base avant
  // que le backend ne lise le booking.
  const flushBillingNotes = async () => {
    const next = billingNotes.trim() || null
    const current = booking.internal_notes || null
    if (next === current) return
    await updateBookingAsync({ id: booking.id, internal_notes: next } as never)
  }
```

4. Ligne 324 : passer les nouvelles props au bouton, et ligne 329 retirer `ref={printRef}` de la div (garder `id='fiche-fonction-content'` et les classes `print:` — elles servent encore au Ctrl+P navigateur) :

```tsx
        <FicheFonctionPdfButton
          bookingId={booking.id}
          flushNotes={flushBillingNotes}
        />
```

- [ ] **Step 3: Compiler et linter le frontend**

Run: `pnpm build && pnpm lint`
Expected: tsc + vite build sans erreur, ESLint sans nouvelle erreur sur les deux fichiers touchés.

- [ ] **Step 4: Commit**

```bash
git add src/features/reservations/components/fiche-fonction-pdf-button.tsx src/features/reservations/components/fiche-fonction.tsx
git commit -m "feat(fiche): le bouton pdf appelle le backend"
```

---

### Task 6: Nettoyage — html2pdf.js et code mort

Plus aucun consommateur de html2pdf.js : `quote-pdf-export.tsx` est mort depuis la migration du devis (commit c95428f) et le bouton fiche vient d'être migré.

**Files:**
- Delete: `src/features/reservations/components/quote-pdf-export.tsx`
- Modify: `package.json` (retirer `"html2pdf.js": "^0.14.0"`, ligne 51), `pnpm-lock.yaml` (via pnpm)

- [ ] **Step 1: Supprimer le composant mort et la dépendance**

```bash
rm src/features/reservations/components/quote-pdf-export.tsx
pnpm remove html2pdf.js
```

- [ ] **Step 2: Vérifier qu'aucune référence ne subsiste**

Run: `grep -rn "html2pdf\|quote-pdf-export" src/ package.json`
Expected: aucun résultat.

Note : ne PAS toucher à `normalizeFrenchSpaces` (`fiche-fonction.tsx:44`, `quote-rounding.ts`) — utilisé par l'affichage écran, hors périmètre.

- [ ] **Step 3: Compiler**

Run: `pnpm build`
Expected: tsc + vite build sans erreur.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/features/reservations/components/quote-pdf-export.tsx
git commit -m "chore: retire html2pdf.js et l export devis client mort"
```

---

### Task 7: Vérification manuelle de bout en bout

Objectif : prouver qu'un PDF long (3+ pages) ne coupe plus rien. Nécessite les deux dev servers et un booking riche (beaucoup de lignes de devis avec descriptions, déroulé/menu/commentaires longs). Si aucun booking de test n'est assez chargé, en enrichir un via l'UI d'abord.

- [ ] **Step 1: Démarrer les serveurs**

Backend : `cd backend && pnpm dev` (port 3001). Frontend : `pnpm dev` (port 5173, proxy Vite vers le backend).

- [ ] **Step 2: Générer la fiche depuis l'UI**

Ouvrir un booking → onglet « Fiche de fonction » → bouton « Imprimer / Enregistrer en PDF ». Vérifier : toast « Fiche vN enregistrée », téléchargement du PDF, nouvelle ligne dans l'onglet documents du booking.

- [ ] **Step 3: Contrôler le PDF généré**

- [ ] Aucune ligne d'item coupée entre deux pages ; les descriptions restent collées à leur ligne
- [ ] En-têtes des tables Prestations/Food répétés sur chaque page où la table continue
- [ ] Blocs Total / Acomptes / Reste / Suivi commercial jamais coupés (basculent entiers)
- [ ] Aucun titre de section orphelin en bas de page
- [ ] Footer « Page X/Y » présent sur toutes les pages
- [ ] Montants identiques à l'écran (Total HT/TVA/TTC, acomptes, reste)
- [ ] Texte sélectionnable dans le PDF (vecteur, pas image) ; accents et € corrects
- [ ] Éditer la note de facturation puis cliquer directement « Imprimer » sans cliquer ailleurs : la note à jour figure dans le PDF

- [ ] **Step 4: Vérifier le versioning**

Regénérer une fiche sur le même booking : le nom passe à vN+1, l'ancienne ligne documents reste.

- [ ] **Step 5: Cas sans devis**

Générer la fiche d'un booking sans devis : PDF avec « Aucun devis associé », pas d'erreur.
