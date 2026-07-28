# Refonte design fiche de fonction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la mise en page du PDF fiche de fonction par le design du template client (wordmark, logos, IvyOra, blocs numérotés, facturation TTC, signature CGV), sans perdre les champs actuels.

**Architecture:** Refonte de `buildFicheFonctionDocDefinition` dans `backend/src/lib/fiche-fonction-pdf.ts` (pdfmake), par remplacement incrémental de sections pour garder un état compilable et rendable à chaque commit. Les fontes IvyOra et les logos (fetch HTTP → data URL) s'ajoutent à l'infra pdfmake existante. L'écran React ne bouge pas.

**Tech Stack:** pdfmake 0.2 (backend CJS, tsc → dist), Supabase JS, tsx pour les scripts.

**Spec:** `docs/superpowers/specs/2026-07-28-fiche-fonction-redesign-design.md`

**Contexte pour l'exécutant :**
- Le backend est CommonJS à l'exécution (`__dirname` disponible, `require` utilisé dans `pdf-generator.ts`). Les imports source portent l'extension `.js`.
- `backend/assets/` n'existe pas encore ; `dist/lib/*.js` et `src/lib/*.ts` résolvent tous deux `../../assets` vers `backend/assets` — c'est ce qui rend le chemin valable en dev (tsx) et en prod (dist).
- Vérification de compilation : `cd backend && pnpm build`. Pas de suite de tests visée : la vérification est un rendu PDF réel (Task 7).
- Style de commit : sujet court français sans accents, préfixe conventionnel (voir `git log`).
- Le seul consommateur de `generateFicheFonctionPdf` est `backend/src/routes/bookings.ts` ; `fetchBookingFullData` et `buildFicheFonctionDocDefinition` ne sont importés nulle part ailleurs. Les changements de signature internes sont sûrs.

---

### Task 1: Extraire les assets du template client

**Files:**
- Create: `backend/assets/fonts/ivyora-display-700.ttf`
- Create: `backend/assets/fonts/ivyora-display-500.ttf`
- Create: `backend/assets/fonts/ivyora-display-400-italic.ttf`

Le template `/Users/thomas/Downloads/fiche-fonction-podium_2 (1).html` embarque en base64 : 3 fontes TTF (ordre des `@font-face` : 700, 500, 400 italic), un wordmark PNG (groupe) et un logo restaurant JPEG. Les fontes vont dans le repo ; les images vont dans le scratchpad (elles serviront à l'upload prod par l'utilisateur, pas au code).

- [ ] **Step 1: Extraire fontes et images**

```bash
python3 - <<'EOF'
import re, base64, pathlib
src = open('/Users/thomas/Downloads/fiche-fonction-podium_2 (1).html', encoding='utf-8').read()
fonts = re.findall(r'data:font/ttf;base64,([A-Za-z0-9+/=]+)', src)
assert len(fonts) == 3, f'attendu 3 fontes, trouve {len(fonts)}'
out = pathlib.Path('backend/assets/fonts'); out.mkdir(parents=True, exist_ok=True)
for name, b64 in zip(['ivyora-display-700.ttf', 'ivyora-display-500.ttf', 'ivyora-display-400-italic.ttf'], fonts):
    (out / name).write_bytes(base64.b64decode(b64))
scratch = pathlib.Path('/private/tmp/claude-501/-Users-thomas-Desktop-WINDSURF-restaurant-crm/cb8bff73-7e31-42d0-aaad-fd96dbe8bee5/scratchpad')
png = re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)', src)
jpg = re.search(r'data:image/jpeg;base64,([A-Za-z0-9+/=]+)', src)
(scratch / 'wordmark-groupe.png').write_bytes(base64.b64decode(png.group(1)))
(scratch / 'logo-podium.jpg').write_bytes(base64.b64decode(jpg.group(1)))
print('ok')
EOF
```

- [ ] **Step 2: Vérifier les fontes**

Run: `file backend/assets/fonts/*.ttf && ls -la backend/assets/fonts/`
Expected: chaque fichier identifié `TrueType Font data`, tailles non nulles (quelques dizaines/centaines de Ko).

- [ ] **Step 3: Commit**

```bash
git add backend/assets/fonts
git commit -m "feat(bookings): fontes ivyora pour la fiche de fonction"
```

---

### Task 2: Déclarer la famille IvyOra dans pdfmake

**Files:**
- Modify: `backend/src/lib/pdf-generator.ts:1-42` (imports + const `fonts`)

- [ ] **Step 1: Ajouter l'import path et la famille IvyOra**

Dans `backend/src/lib/pdf-generator.ts`, ajouter après `import { readFileSync } from 'fs'` :

```ts
import { join } from 'path'
```

Puis compléter la déclaration `const fonts` existante (garder Roboto tel quel) :

```ts
// IvyOra Display : fonte serif du template fiche de fonction (fournie par le client)
const ivyoraDir = join(__dirname, '../../assets/fonts')

const fonts = {
  Roboto: {
    normal: robotoFile('roboto-latin-400-normal.woff'),
    bold: robotoFile('roboto-latin-700-normal.woff'),
    italics: robotoFile('roboto-latin-400-italic.woff'),
    bolditalics: robotoFile('roboto-latin-700-italic.woff'),
  },
  IvyOra: {
    normal: readFileSync(join(ivyoraDir, 'ivyora-display-500.ttf')),
    bold: readFileSync(join(ivyoraDir, 'ivyora-display-700.ttf')),
    italics: readFileSync(join(ivyoraDir, 'ivyora-display-400-italic.ttf')),
    bolditalics: readFileSync(join(ivyoraDir, 'ivyora-display-700.ttf')),
  },
}
```

- [ ] **Step 2: Vérifier la compilation et le chargement runtime**

Run: `cd backend && pnpm build && node -e "require('./dist/lib/pdf-generator.js')" && echo OK`
Expected: build sans erreur, `OK` (le require prouve que les TTF se chargent depuis dist).

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/pdf-generator.ts
git commit -m "feat(bookings): famille ivyora declaree dans pdfmake"
```

---

### Task 3: Étendre les données récupérées (statut, logos, commercial)

**Files:**
- Modify: `backend/src/lib/fiche-fonction-pdf.ts` (types, `fetchBookingFullData`, `generateFicheFonctionPdf`)

- [ ] **Step 1: Étendre le type `FicheBookingData`**

Dans l'interface `FicheBookingData` :
- remplacer la ligne `restaurant: { id: string; name: string | null; color: string | null } | null` par :

```ts
  restaurant: {
    id: string
    name: string | null
    color: string | null
    logo_url: string | null
    address: string | null
    postal_code: string | null
    city: string | null
  } | null
```

- ajouter après le champ `restaurant` :

```ts
  status: { name: string | null; color: string | null } | null
```

- [ ] **Step 2: Étendre le select et le retour de `fetchBookingFullData`**

Dans le select de `fetchBookingFullData`, remplacer :

```
      restaurant:restaurants(id, name, color),
```

par :

```
      restaurant:restaurants(id, name, color, logo_url, address, postal_code, city),
      status:statuses(name, color),
```

Remplacer le bloc de résolution des `assigned_user_ids` (variable `assignedNames`) et le return par :

```ts
  const ids = booking.assigned_user_ids || []
  let assignedUsers: FicheAssignedUser[] = []
  if (ids.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, phone, email')
      .in('id', ids)
    assignedUsers = (users || [])
      .map((u) => ({
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        phone: u.phone as string | null,
        email: u.email as string | null,
      }))
      .filter((u) => u.name)
  }

  return { booking, assignedUsers }
```

Ajouter l'interface près des autres (après `FichePayment`) :

```ts
export interface FicheAssignedUser {
  name: string
  phone: string | null
  email: string | null
}
```

Adapter la signature de retour de `fetchBookingFullData` :

```ts
export async function fetchBookingFullData(bookingId: string): Promise<{
  booking: FicheBookingData
  assignedUsers: FicheAssignedUser[]
}> {
```

- [ ] **Step 3: Helper de fetch d'image et images dans `generateFicheFonctionPdf`**

Ajouter après `fetchBookingFullData` :

```ts
// Logos convertis en data URL pour pdfmake ; toute erreur réseau rend le logo
// absent sans bloquer la génération (boundary externe)
async function fetchImageDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').split(';')[0]
    if (!/^image\/(png|jpeg)$/.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export interface FicheImages {
  orgLogo: string | null
  restoLogo: string | null
}
```

Remplacer `generateFicheFonctionPdf` par :

```ts
export async function generateFicheFonctionPdf(bookingId: string): Promise<{
  buffer: Buffer
  booking: FicheBookingData
}> {
  const { booking, assignedUsers } = await fetchBookingFullData(bookingId)

  let orgLogoUrl: string | null = null
  if (booking.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', booking.organization_id)
      .single()
    orgLogoUrl = (org?.logo_url as string | null) ?? null
  }
  const [orgLogo, restoLogo] = await Promise.all([
    fetchImageDataUrl(orgLogoUrl),
    fetchImageDataUrl(booking.restaurant?.logo_url ?? null),
  ])

  const docDefinition = buildFicheFonctionDocDefinition(booking, assignedUsers, {
    orgLogo,
    restoLogo,
  })
  const buffer = await renderPdfToBuffer(docDefinition)
  return { buffer, booking }
}
```

- [ ] **Step 4: Adapter provisoirement `buildFicheFonctionDocDefinition`**

Changer sa signature (le corps reste l'ancien pour l'instant ; Task 4-6 le remplacent) :

```ts
export function buildFicheFonctionDocDefinition(
  booking: FicheBookingData,
  assignedUsers: FicheAssignedUser[],
  images: FicheImages
): TDocumentDefinitions {
  const assignedNames = assignedUsers.map((u) => u.name)
  void images
```

(`void images` évite l'erreur unused tant que le corps n'utilise pas encore les logos ; supprimé en Task 4.)

- [ ] **Step 5: Vérifier la compilation**

Run: `cd backend && pnpm build`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/fiche-fonction-pdf.ts
git commit -m "feat(bookings): statut, logos et coordonnees commercial dans les donnees fiche"
```

---

### Task 4: Nouvelle entête (topstrip, masthead, grille essentiel)

**Files:**
- Modify: `backend/src/lib/fiche-fonction-pdf.ts`

Principe des Tasks 4-6 : on remplace l'assemblage section par section en gardant le fichier compilable. Les helpers obsolètes sont supprimés dans la task qui retire leur dernier usage.

- [ ] **Step 1: Constantes et helpers du nouveau design**

Remplacer le bloc de constantes existant (`const GRAY = ...` jusqu'à `const BORDER = ...` inclus) par (garder `ficheTableLayout` provisoirement, encore utilisé par les anciennes sections) :

```ts
// Palette du template client
const INK = '#161412'
const INK_SOFT = '#4A413A'
const INK_MUTE = '#8A8278'
const RULE = '#E0D8CB'
const RULE_SOFT = '#ECE5DA'
const OK = '#2D5F3F'
const OK_BG = '#ECF1ED'
const ALERT = '#B8341A'
const ALERT_BG = '#FBE9E5'
const CREAM = '#FBF9F5'
const GRAY = '#6b7280'
const LIGHT_GRAY = '#9ca3af'
const BORDER = '#e5e7eb'
// Largeur utile : A4 (595.28pt) moins marges latérales de 34pt
const CONTENT_WIDTH = 595.28 - 2 * 34
```

Ajouter après `ficheTableLayout` :

```ts
function hairline(color: string, width: number): Content {
  return {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: CONTENT_WIDTH,
        y2: 0,
        lineWidth: width,
        lineColor: color,
      },
    ],
  }
}

// Entête de bloc numéroté : "01  CONTACTS" + filet noir
function blockHead(num: string, title: string, accent: string): Content {
  return {
    stack: [
      {
        columns: [
          { width: 'auto', text: num, font: 'IvyOra', italics: true, fontSize: 9.5, color: accent },
          {
            width: '*',
            text: title.toUpperCase(),
            fontSize: 7.5,
            bold: true,
            characterSpacing: 1.6,
            margin: [8, 1.5, 0, 0] as [number, number, number, number],
          },
        ],
      },
      { ...hairline(INK, 0.75), margin: [0, 3, 0, 0] as [number, number, number, number] },
    ],
    headlineLevel: 1,
    margin: [0, 16, 0, 8] as [number, number, number, number],
  }
}
```

- [ ] **Step 2: Builders topstrip, masthead, grille essentiel**

Ajouter après `blockHead` :

```ts
function topstrip(orgLogo: string | null): Content {
  return {
    stack: [
      {
        columns: [
          orgLogo
            ? { width: 'auto', image: orgLogo, fit: [150, 16] as [number, number] }
            : { width: 'auto', text: '' },
          {
            width: '*',
            text: 'PÔLE ÉVÉNEMENTIEL',
            fontSize: 6.5,
            bold: true,
            color: INK_MUTE,
            characterSpacing: 1.6,
            alignment: 'right' as const,
            margin: [0, 5, 0, 0] as [number, number, number, number],
          },
        ],
      },
      { ...hairline(RULE, 0.5), margin: [0, 6, 0, 0] as [number, number, number, number] },
    ],
  }
}

function masthead(
  booking: FicheBookingData,
  restoLogo: string | null,
  accent: string,
  bookingRef: string
): Content {
  const statusName = booking.status?.name || null
  // statuses.color est un hex (cf. defaults onboarding) ; garde-fou si autre format
  const rawColor = booking.status?.color || ''
  const badgeColor = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : accent

  const identity: Content = {
    columns: [
      ...(restoLogo
        ? [{ width: 58, image: restoLogo, fit: [52, 52] as [number, number] }]
        : []),
      {
        width: '*',
        stack: [
          {
            text: "L'ÉTABLISSEMENT",
            fontSize: 6.5,
            bold: true,
            color: INK_MUTE,
            characterSpacing: 1.6,
          },
          {
            text: booking.restaurant?.name || 'Restaurant',
            font: 'IvyOra',
            bold: true,
            fontSize: 21,
            margin: [0, 3, 0, 0] as [number, number, number, number],
          },
        ],
        margin: [restoLogo ? 10 : 0, 6, 0, 0] as [number, number, number, number],
      },
    ],
  }

  const meta: Content = {
    stack: [
      {
        text: 'FICHE DE FONCTION',
        fontSize: 7.5,
        bold: true,
        characterSpacing: 1.6,
        alignment: 'right' as const,
      },
      {
        text: `RÉF · ${bookingRef}`,
        fontSize: 7,
        color: INK_MUTE,
        characterSpacing: 0.5,
        alignment: 'right' as const,
        margin: [0, 3, 0, 0] as [number, number, number, number],
      },
      ...(statusName
        ? [
            {
              columns: [
                { width: '*', text: '' },
                {
                  width: 'auto',
                  table: {
                    body: [
                      [
                        {
                          text: statusName.toUpperCase(),
                          fontSize: 6.5,
                          bold: true,
                          color: 'white',
                          characterSpacing: 1,
                          fillColor: badgeColor,
                          margin: [6, 3, 6, 3] as [number, number, number, number],
                        },
                      ],
                    ],
                  },
                  layout: 'noBorders' as const,
                },
              ],
              margin: [0, 8, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
    ],
  }

  return {
    stack: [
      { columns: [{ width: '*', ...identity } as Column, { width: 'auto', ...meta } as Column] },
      { ...hairline(INK, 1), margin: [0, 10, 0, 0] as [number, number, number, number] },
    ],
    unbreakable: true,
    margin: [0, 12, 0, 0] as [number, number, number, number],
  }
}

function essentialCell(labelText: string, value: string | null, sub: string | null): TableCell {
  return {
    stack: [
      {
        text: labelText.toUpperCase(),
        fontSize: 6.5,
        bold: true,
        color: INK_MUTE,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      { text: value || DASH, font: 'IvyOra', bold: true, fontSize: 13 },
      ...(sub
        ? [{ text: sub, fontSize: 7.5, color: INK_SOFT, margin: [0, 2, 0, 0] as [number, number, number, number] }]
        : []),
    ],
  }
}

function essentialGrid(booking: FicheBookingData): Content {
  let dateMain: string | null = null
  let dateSub: string | null = null
  if (booking.event_date) {
    const d = new Date(booking.event_date)
    const s = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
    dateMain = s.charAt(0).toUpperCase() + s.slice(1)
    dateSub = String(d.getFullYear())
  }
  const start = (booking.start_time || '').slice(0, 5)
  const end = (booking.end_time || '').slice(0, 5)
  const contactName = booking.contact
    ? [booking.contact.first_name, booking.contact.last_name].filter(Boolean).join(' ')
    : null

  return {
    table: {
      widths: ['*', '*', '*', '*'],
      body: [
        [
          essentialCell('Date', dateMain, dateSub),
          essentialCell('Arrivée', start || null, end ? `jusqu'à ${end}` : null),
          essentialCell(
            'Invités',
            booking.guests_count != null ? `${booking.guests_count} pax` : null,
            contactName
          ),
          essentialCell('Occasion', booking.occasion, booking.source ? `Source · ${booking.source}` : null),
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number, node: any) => (i === node.table.body.length ? 0.5 : 0),
      vLineWidth: (i: number, node: any) =>
        i === 0 || i === node.table.widths.length ? 0 : 0.5,
      hLineColor: () => RULE,
      vLineColor: () => RULE_SOFT,
      paddingLeft: (i: number) => (i === 0 ? 0 : 10),
      paddingRight: () => 10,
      paddingTop: () => 8,
      paddingBottom: () => 10,
    },
    unbreakable: true,
    margin: [0, 10, 0, 0] as [number, number, number, number],
  }
}
```

- [ ] **Step 3: Brancher l'entête dans l'assemblage**

Dans `buildFicheFonctionDocDefinition` :
- supprimer la ligne `void images` et remplacer le bloc « Bandeau header » (le `content.push({ table: ... layout: 'noBorders' ...})` du bandeau couleur), le bloc « Horaires » (`infoRow` avec `formatHorairesGlobal`) et le bloc « Compte / Contact / Coordonnées » par :

```ts
  content.push(topstrip(images.orgLogo))
  content.push(masthead(booking, images.restoLogo, color, bookingRef))
  content.push(essentialGrid(booking))
```

- supprimer la fonction `formatHorairesGlobal` (plus utilisée). Les variables `contactName`/`coordonnees` de l'ancien bloc compte disparaissent avec lui.
- dans le return final, changer `pageMargins` en `[34, 28, 34, 48]` et remplacer le style `footer` par `footer: { fontSize: 6.5, color: INK_MUTE }` (le contenu du footer est refait en Task 6).

- [ ] **Step 4: Vérifier la compilation**

Run: `cd backend && pnpm build`
Expected: aucune erreur (si `formatDateLong` ou d'autres helpers deviennent unused, les laisser : ils resservent en Task 6 ; seuls ceux listés à supprimer le sont).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/fiche-fonction-pdf.ts
git commit -m "feat(bookings): nouvelle entete de la fiche de fonction"
```

---

### Task 5: Blocs contacts, menu, allergies, boissons, mise en place, déroulé

**Files:**
- Modify: `backend/src/lib/fiche-fonction-pdf.ts`

- [ ] **Step 1: Builders cartes contacts, menu et bandeau allergies**

Ajouter après `essentialGrid` :

```ts
function contactCard(role: string, name: string | null, infoLines: (string | null | undefined)[]): Content {
  return {
    stack: [
      {
        text: role.toUpperCase(),
        fontSize: 6.5,
        bold: true,
        color: INK_MUTE,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 3] as [number, number, number, number],
      },
      { text: name || DASH, font: 'IvyOra', bold: true, fontSize: 11.5 },
      {
        text: infoLines.filter(Boolean).join('\n'),
        fontSize: 8.5,
        color: INK_SOFT,
        lineHeight: 1.4,
        margin: [0, 3, 0, 0] as [number, number, number, number],
      },
    ],
  }
}

// Grille de cartes 2 colonnes
function contactsBlock(
  booking: FicheBookingData,
  commercial: FicheAssignedUser | null,
  accent: string
): Content {
  const contactName = booking.contact
    ? [booking.contact.first_name, booking.contact.last_name].filter(Boolean).join(' ')
    : null
  const cards: Content[] = [
    contactCard('Client référent', contactName, [booking.contact?.phone, booking.contact?.email]),
    contactCard('Société', booking.contact?.company?.name || null, []),
    contactCard('Commercial', commercial?.name || null, [commercial?.phone, commercial?.email]),
  ]
  if (
    booking.contact_sur_place_nom ||
    booking.contact_sur_place_tel ||
    booking.contact_sur_place_societe
  ) {
    cards.push(
      contactCard('Contact sur place', booking.contact_sur_place_nom, [
        booking.contact_sur_place_tel,
        booking.contact_sur_place_societe,
      ])
    )
  }
  const rows: Content[] = []
  for (let i = 0; i < cards.length; i += 2) {
    rows.push({
      columns: cards.slice(i, i + 2).map((c) => ({ width: '*', ...(c as object) })) as Column[],
      columnGap: 24,
      margin: [0, i === 0 ? 0 : 10, 0, 0] as [number, number, number, number],
    })
  }
  return {
    stack: [blockHead('01', 'Client & contacts', accent), ...rows],
    unbreakable: true,
  }
}

function menuBlock(booking: FicheBookingData, accent: string): Content {
  const courses: [string, string | null][] = [
    ['Apéritif', booking.menu_aperitif],
    ['Entrée', booking.menu_entree],
    ['Plat', booking.menu_plat],
    ['Dessert', booking.menu_dessert],
  ]
  return {
    stack: [
      blockHead('02', 'Menu', accent),
      {
        table: {
          widths: [95, '*'],
          dontBreakRows: true,
          body: courses.map(([course, value]) => [
            {
              text: course.toUpperCase(),
              fontSize: 7,
              bold: true,
              color: accent,
              characterSpacing: 1.4,
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
            { text: value || DASH, font: 'IvyOra', fontSize: 10.5, lineHeight: 1.3 },
          ]),
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 8,
          paddingTop: () => 0,
          paddingBottom: () => 6,
        },
      },
    ],
  }
}

function allergiesBanner(text: string | null): Content {
  const filled = !!(text && text.trim())
  const bar = filled ? ALERT : OK
  const bg = filled ? ALERT_BG : OK_BG
  return {
    table: {
      widths: [3, 'auto', '*'],
      body: [
        [
          { text: '', fillColor: bar },
          {
            text: 'ALLERGIES & RÉGIMES',
            fontSize: 7,
            bold: true,
            color: bar,
            characterSpacing: 1.4,
            fillColor: bg,
            margin: [8, 8, 4, 8] as [number, number, number, number],
          },
          {
            text: filled
              ? text!.trim()
              : "Aucune allergie déclarée. À reconfirmer à l'accueil le jour J.",
            fontSize: 9,
            fillColor: bg,
            lineHeight: 1.4,
            margin: [4, 7, 8, 7] as [number, number, number, number],
          },
        ],
      ],
    },
    layout: 'noBorders',
    unbreakable: true,
    margin: [0, 12, 0, 0] as [number, number, number, number],
  }
}

// Bloc titre + texte libre (sécable : les TEXT longs ne doivent pas être unbreakable)
function freetextBlock(num: string, title: string, text: string | null, accent: string): Content {
  return {
    stack: [
      blockHead(num, title, accent),
      { text: text || DASH, fontSize: 9, lineHeight: 1.55 },
    ],
  }
}
```

- [ ] **Step 2: Brancher les blocs dans l'assemblage**

Dans `buildFicheFonctionDocDefinition`, remplacer les sections `textSection('Mise en place', ...)`, `textSection('Déroulé', ...)`, l'`infoRow` Espace/Nombre de personnes, le bloc Menu 2 colonnes et l'`infoRow` Allergies/Prestations souhaitées par (placés juste après `content.push(essentialGrid(booking))`, AVANT la partie devis qui sera refaite en Task 6) :

```ts
  content.push(contactsBlock(booking, assignedUsers[0] || null, color))
  content.push(menuBlock(booking, color))
  content.push(allergiesBanner(booking.allergies_regimes))
  content.push(freetextBlock('03', 'Boissons', booking.menu_boissons, color))
  content.push({
    stack: [
      blockHead('04', 'Mise en place', color),
      ...(booking.space?.name
        ? [
            {
              text: `Espace · ${booking.space.name}`,
              fontSize: 8.5,
              bold: true,
              color: INK_SOFT,
              margin: [0, 0, 0, 6] as [number, number, number, number],
            },
          ]
        : []),
      { text: booking.mise_en_place || DASH, fontSize: 9, lineHeight: 1.55 },
    ],
  })
  content.push(freetextBlock('05', 'Déroulé', booking.deroulement, color))
```

Notes de câblage :
- `assignedUsers` remplace `assignedNames` comme paramètre depuis Task 3 ; la ligne `const assignedNames = assignedUsers.map((u) => u.name)` reste pour la section Suivi commercial (refaite en Task 6).
- Le « Nombre de personnes » de l'ancien `infoRow` est déjà couvert par la grille essentiel (Invités). Les « Prestations souhaitées » sont réintégrées en Task 6 (bloc 07).
- Supprimer ce qui devient inutilisé par ce remplacement : l'ancien bloc Menu, l'ancien `infoRow` Allergies/Prestations, et l'appel `textSection('Commentaires facturation', ...)` reste en place (déplacé/refait en Task 6).

- [ ] **Step 3: Vérifier la compilation**

Run: `cd backend && pnpm build`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/fiche-fonction-pdf.ts
git commit -m "feat(bookings): blocs contacts, menu et textes de la fiche"
```

---

### Task 6: Facturation TTC, commentaires, suivi, signature, footer

**Files:**
- Modify: `backend/src/lib/fiche-fonction-pdf.ts`

- [ ] **Step 1: Builder facturation TTC**

Ajouter après `freetextBlock` :

```ts
const CGV_TEXT =
  'Le client signataire reconnaît avoir pris connaissance et accepté les conditions générales de privatisation jointes au devis, et valide le présent brief comme bon à exécuter. Toute modification du nombre de couverts ou du menu doit être communiquée au commercial au plus tard 48 heures avant la prestation.'

function facturationBlock(
  quote: FicheQuote | null,
  quotes: FicheQuote[],
  payments: FichePayment[],
  accent: string
): Content {
  if (!quote) {
    return {
      stack: [
        blockHead('06', 'Facturation', accent),
        { text: 'Aucun devis associé', alignment: 'center', color: INK_MUTE, margin: [0, 6, 0, 6] as [number, number, number, number] },
      ],
    }
  }

  const items = quote.quote_items || []
  const totalTtc =
    quote.total_ttc ?? items.reduce((s, i) => s + (i.total_ttc || 0), 0)
  const deposits = payments.filter(
    (p) => p.payment_modality === 'acompte' || p.payment_type === 'deposit'
  )
  const quoteNumberById = new Map<string, string>()
  for (const q of quotes) {
    if (q.id && q.quote_number) quoteNumberById.set(q.id, q.quote_number)
  }
  const remaining = getRemainingBalance(totalTtc, payments)

  const body: TableCell[][] = items.map((item) => [
    {
      stack: [
        { text: item.name, fontSize: 9, color: INK_SOFT },
        ...(item.description
          ? [{ text: item.description, fontSize: 7.5, color: INK_MUTE, margin: [0, 1, 0, 0] as [number, number, number, number] }]
          : []),
      ],
    },
    {
      text: item.quantity != null ? `×${item.quantity}` : '',
      fontSize: 8,
      color: INK_MUTE,
      alignment: 'right' as const,
    },
    { text: formatEuroDecimal(item.total_ttc || 0), fontSize: 9, bold: true, alignment: 'right' as const },
  ])
  if (items.length === 0) {
    body.push([
      { text: 'Aucune ligne', colSpan: 3, alignment: 'center' as const, color: INK_MUTE },
      {},
      {},
    ])
  }

  const totalIdx = body.length
  body.push([
    { text: 'TOTAL TTC', fontSize: 8, bold: true, characterSpacing: 1, margin: [0, 4, 0, 0] as [number, number, number, number] },
    { text: '' },
    { text: formatEuroDecimal(totalTtc), font: 'IvyOra', bold: true, fontSize: 14, alignment: 'right' as const },
  ])

  for (const p of deposits) {
    const isPaid = p.status === 'paid' || p.status === 'completed'
    const num = p.quote_id ? quoteNumberById.get(p.quote_id) : null
    const label = ['Acompte', num, isPaid ? 'payé' : 'en attente'].filter(Boolean).join(' · ')
    body.push([
      { text: label, fontSize: 9, color: isPaid ? OK : INK_MUTE },
      { text: '' },
      {
        text: `${isPaid ? '− ' : ''}${formatEuroDecimal(p.amount || 0)}`,
        fontSize: 9,
        bold: true,
        color: isPaid ? OK : INK_MUTE,
        alignment: 'right' as const,
      },
    ])
  }

  const soldeIdx = body.length
  body.push([
    { text: 'Solde', fontSize: 9, bold: true },
    { text: '' },
    { text: formatEuroDecimal(remaining), font: 'IvyOra', bold: true, fontSize: 11, color: accent, alignment: 'right' as const },
  ])

  return {
    stack: [
      blockHead('06', 'Facturation', accent),
      {
        table: { widths: ['*', 30, 78], body, dontBreakRows: true },
        layout: {
          hLineWidth: (i: number) => {
            if (i === 0 || i === body.length) return 0.75
            if (i === totalIdx) return 0.75
            if (i === soldeIdx) return 0.5
            return 0
          },
          hLineColor: (i: number) => (i === totalIdx ? INK : RULE),
          vLineWidth: (i: number, node: any) =>
            i === 0 || i === node.table.widths.length ? 0.75 : 0,
          vLineColor: () => RULE,
          fillColor: () => CREAM,
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
    ],
  }
}

function signatureBlock(): Content {
  return {
    stack: [
      hairline(INK, 1.5),
      { text: CGV_TEXT, fontSize: 8, color: INK_SOFT, lineHeight: 1.45, margin: [0, 8, 0, 14] as [number, number, number, number] },
      hairline(INK, 0.75),
      {
        text: 'BON POUR ACCORD · LE CLIENT',
        fontSize: 7.5,
        bold: true,
        characterSpacing: 1.4,
        margin: [0, 8, 0, 0] as [number, number, number, number],
      },
      {
        text: 'Mention « lu et approuvé » manuscrite, date et signature',
        font: 'IvyOra',
        italics: true,
        fontSize: 8,
        color: INK_MUTE,
        margin: [0, 2, 0, 48] as [number, number, number, number],
      },
      {
        columns: ['Fait à', 'Le', 'Signature'].map((t) => ({
          width: '*' as const,
          stack: [
            { text: t, fontSize: 8, color: INK_SOFT, margin: [0, 0, 0, 2] as [number, number, number, number] },
            hairline(RULE, 0.5),
          ],
        })),
        columnGap: 14,
      },
    ],
    unbreakable: true,
    margin: [0, 20, 0, 0] as [number, number, number, number],
  }
}
```

- [ ] **Step 2: Remplacer l'assemblage devis/commentaires/suivi et le footer**

Dans `buildFicheFonctionDocDefinition` :

Supprimer tout l'ancien pan devis (le `if (!activeQuote) ... else { itemsTable Prestations/Food, amountsTable Total, Acomptes, Reste }`), l'ancien `textSection('Commentaires facturation', ...)`, l'ancien bloc Commentaires combinés et l'ancien bloc Suivi commercial. À la place, après `content.push(freetextBlock('05', 'Déroulé', ...))` :

```ts
  content.push(facturationBlock(activeQuote, quotes, payments, color))

  // Bloc 07 : textes internes conservés
  const commentairesBlocks: string[] = []
  if (booking.commentaires) commentairesBlocks.push(booking.commentaires)
  if (booking.instructions_speciales)
    commentairesBlocks.push(`Instructions spéciales :\n${booking.instructions_speciales}`)
  content.push({
    stack: [
      blockHead('07', 'Commentaires', color),
      labelValue('Commentaires facturation', booking.internal_notes),
      {
        ...(labelValue('Commentaires', commentairesBlocks.join('\n\n').trim() || null) as object),
        margin: [0, 6, 0, 0] as [number, number, number, number],
      },
      {
        ...(labelValue('Prestations souhaitées', booking.prestations_souhaitees) as object),
        margin: [0, 6, 0, 0] as [number, number, number, number],
      },
    ],
  })

  // Bloc 08 : suivi commercial
  content.push({
    stack: [
      blockHead('08', 'Suivi commercial', color),
      {
        columns: [
          {
            width: '*',
            stack: [
              labelValue('Commerciaux assignés', assignedNames.join(', ') || null),
              {
                ...(labelValue('Relance', booking.relance) as object),
                margin: [0, 6, 0, 0] as [number, number, number, number],
              },
              {
                ...(labelValue(
                  'Budget client',
                  typeof booking.budget_client === 'number' &&
                    Number.isFinite(booking.budget_client)
                    ? formatEuroAdaptive(booking.budget_client)
                    : booking.budget_client
                      ? String(booking.budget_client).trim()
                      : null
                ) as object),
                margin: [0, 6, 0, 0] as [number, number, number, number],
              },
            ],
          },
          {
            width: '*',
            stack: [
              labelValue('Option', booking.option),
              {
                ...(labelValue(
                  'Date signature devis',
                  formatDateLong(booking.date_signature_devis)
                ) as object),
                margin: [0, 6, 0, 0] as [number, number, number, number],
              },
            ],
          },
        ] as Column[],
        columnGap: 24,
      },
    ],
    unbreakable: true,
  })

  content.push(signatureBlock())
```

Adapter `labelValue` aux nouveaux styles (remplacer son corps) :

```ts
function labelValue(label: string, value: string | null | undefined): Content {
  return {
    stack: [
      {
        text: label.toUpperCase(),
        fontSize: 6.5,
        bold: true,
        color: INK_MUTE,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 2] as [number, number, number, number],
      },
      { text: value || DASH, fontSize: 9, lineHeight: 1.4 },
    ],
  }
}
```

Remplacer le `footer` du return par :

```ts
    footer: (currentPage: number, pageCount: number) => {
      const addr = [
        booking.restaurant?.address,
        [booking.restaurant?.postal_code, booking.restaurant?.city].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ')
      return {
        columns: [
          {
            text: [
              { text: (booking.restaurant?.name || '').toUpperCase(), bold: true },
              { text: addr ? ` · ${addr}` : '' },
            ],
            style: 'footer',
          },
          {
            text: `Émis le ${printedAt} · Page ${currentPage}/${pageCount}`,
            style: 'footer',
            alignment: 'right' as const,
          },
        ],
        style: 'footer',
        margin: [34, 10, 34, 0] as [number, number, number, number],
      }
    },
```

- [ ] **Step 3: Nettoyage des helpers et styles obsolètes**

Supprimer : `computeVatBreakdown`, `itemsTable`, `amountsTable`, `textSection`, `sectionTitle`, `infoRow`, `headerCell`, `ficheTableLayout`, les variables `foodItems`/`prestationItems`/`totals`/`items` de l'assemblage, les constantes `GRAY`/`LIGHT_GRAY`/`BORDER` si plus référencées, et dans `styles:` les entrées devenues inutiles (`headerTitle`, `headerDocTitle`, `headerSmall`, `ficheSectionTitle`, `ficheLabel`, `ficheValue`, `ficheText`, `ficheDesc`, `ficheTableHeader`, `ficheTableCell`). Garder `footer`. Garder `pageBreakBefore` et `defaultStyle` tels quels.

- [ ] **Step 4: Vérifier compilation + lint**

Run: `cd backend && pnpm build && pnpm lint`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/fiche-fonction-pdf.ts
git commit -m "feat(bookings): facturation ttc, signature et assemblage de la fiche"
```

---

### Task 7: Script de rendu et vérification visuelle

**Files:**
- Create: `backend/src/scripts/render-fiche.ts` (non commité — le dossier scripts est déjà untracked, cf. `git status`)

- [ ] **Step 1: Écrire le script de rendu**

```ts
import { writeFileSync } from 'fs'
import { generateFicheFonctionPdf } from '../lib/fiche-fonction-pdf.js'
import { supabase } from '../lib/supabase.js'

// Usage : tsx --env-file=.env src/scripts/render-fiche.ts [bookingId|--latest|--long] [out.pdf]
// --latest : dernier booking avec paiement payé ; --long : booking aux textes les plus longs

async function pickLatest(): Promise<string> {
  const { data } = await supabase
    .from('payments')
    .select('booking_id, created_at')
    .in('status', ['paid', 'completed'])
    .not('booking_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
  const id = data?.[0]?.booking_id
  if (!id) throw new Error('aucun booking avec paiement paye')
  return id as string
}

async function pickLong(): Promise<string> {
  const { data } = await supabase
    .from('bookings')
    .select('id, mise_en_place, deroulement, commentaires, menu_plat')
    .not('mise_en_place', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300)
  const best = (data || [])
    .map((b) => ({
      id: b.id as string,
      len: [b.mise_en_place, b.deroulement, b.commentaires, b.menu_plat]
        .map((t) => (t || '').length)
        .reduce((a, c) => a + c, 0),
    }))
    .sort((a, b) => b.len - a.len)[0]
  if (!best) throw new Error('aucun booking trouve')
  return best.id
}

async function main() {
  const arg = process.argv[2] || '--latest'
  const id = arg === '--latest' ? await pickLatest() : arg === '--long' ? await pickLong() : arg
  const out = process.argv[3] || `/tmp/fiche-${id.slice(0, 8)}.pdf`
  const { buffer } = await generateFicheFonctionPdf(id)
  writeFileSync(out, buffer)
  console.log(`booking ${id} -> ${out} (${buffer.length} octets)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Rendre un booking « riche » (devis + acompte payé)**

Run: `cd backend && npx tsx --env-file=.env src/scripts/render-fiche.ts --latest /private/tmp/claude-501/-Users-thomas-Desktop-WINDSURF-restaurant-crm/cb8bff73-7e31-42d0-aaad-fd96dbe8bee5/scratchpad/fiche-riche.pdf`
Expected: log `booking <id> -> ... (<n> octets)`, pas d'exception. Lecture seule sur la base, aucun write.

- [ ] **Step 3: Rendre un booking « long » (multi-pages)**

Run: `cd backend && npx tsx --env-file=.env src/scripts/render-fiche.ts --long /private/tmp/claude-501/-Users-thomas-Desktop-WINDSURF-restaurant-crm/cb8bff73-7e31-42d0-aaad-fd96dbe8bee5/scratchpad/fiche-longue.pdf`
Expected: PDF généré, plusieurs pages.

- [ ] **Step 4: Vérification visuelle (Read des deux PDF)**

Ouvrir les deux PDF (outil Read) et vérifier :
- entête : wordmark (ou absence propre si logo org vide en base), logo + nom restaurant en IvyOra, RÉF, badge statut
- grille essentiel : 4 colonnes avec séparateurs, valeurs serif
- blocs numérotés 01-08 avec filets, bandeau allergies vert ou rouge
- facturation : encadré crème, lignes TTC, total serif, acomptes verts « − montant », solde couleur restaurant
- signature : CGV + zone Fait à / Le / Signature
- footer sur CHAQUE page : nom + adresse à gauche, « Émis le … · Page X/Y » à droite
- multi-pages : aucun titre de bloc orphelin en bas de page, aucune ligne de facturation coupée, textes longs coupés proprement
Expected: tout conforme ; sinon corriger `fiche-fonction-pdf.ts` et re-rendre (boucle Steps 2-4).

- [ ] **Step 5: Commit des éventuelles corrections**

```bash
git add backend/src/lib/fiche-fonction-pdf.ts
git commit -m "fix(bookings): ajustements rendu fiche de fonction"
```

(Uniquement s'il y a eu des corrections au Step 4.)

---

## Notes de fin

- L'upload du wordmark groupe (`scratchpad/wordmark-groupe.png`) dans les réglages de l'organisation prod est une étape ops hors code : la remettre à l'utilisateur avec les PDF de vérification.
- Déploiement : backend seul concerné ; `backend/assets/` doit être présent au runtime Render (il l'est, le dossier est commité et résolu relativement à `dist/lib`).
