// Bloc signature des emails client. Les gabarits posent le bloc de repli (nom
// du commercial), sendClientEmail le remplace par la signature de la personne
// dont la boite envoie reellement : les gabarits ne connaissent pas encore
// l'expediteur au moment ou ils sont rendus.
const SIG_OPEN = '<!--mev:sig-->'
const SIG_CLOSE = '<!--/mev:sig-->'
const SIG_RE = /<!--mev:sig-->([\s\S]*?)<!--\/mev:sig-->/g

// Sites, emails et telephones en une seule passe : des passes successives
// re-linkifieraient le contenu des href deja produits. Le telephone est
// borne a la forme francaise (33/0 + 9 chiffres) pour ne pas happer un
// SIRET ou une autre suite de chiffres separes par des espaces.
const LINKIFY =
  /(https?:\/\/[^\s<]+|www\.[^\s<]+|[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+33|0)(?:[\s.-]?\d){9}(?!\d))/g

export const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function signatureBlock(fallbackName: string): string {
  return `${SIG_OPEN}<p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">${esc(fallbackName)}</p>${SIG_CLOSE}`
}

function linkifyLine(line: string): string {
  return line.replace(LINKIFY, (raw) => {
    // Ponctuation de fin de phrase happee par le match (url., site), email.) :
    // on la ressort du lien et on la recolle apres la balise.
    const trail = raw.match(/[.,;:)]+$/)?.[0] ?? ''
    const m = trail ? raw.slice(0, -trail.length) : raw
    if (/^https?:\/\//i.test(m))
      return `<a href="${m}" style="color:#0d7377;">${m}</a>${trail}`
    if (/^www\./i.test(m))
      return `<a href="https://${m}" style="color:#0d7377;">${m}</a>${trail}`
    if (m.includes('@'))
      return `<a href="mailto:${m}" style="color:#0d7377;">${m}</a>${trail}`
    return `<a href="tel:${m.replace(/[\s.-]/g, '')}" style="color:#444;text-decoration:none;">${m}</a>${trail}`
  })
}

// Linkification ligne par ligne : \s dans le motif telephone traverserait
// sinon un retour a la ligne et collerait deux numeros en un seul lien.
export function renderSignature(raw: string): string {
  const lines = esc(raw.trim()).split(/\r?\n/).map(linkifyLine)
  return `<p style="margin:0;font-size:14px;line-height:1.6;color:#444;">${lines.join('<br/>')}</p>`
}

// Marqueurs toujours retires (repli garde si signature vide) ; remplacement par fonction pour ne pas interpreter $&/$' dans la signature.
export function applySignature(html: string, raw: string | null): string {
  const rendered = raw && raw.trim() ? renderSignature(raw) : null
  return html.replace(
    SIG_RE,
    (_match, fallback: string) => rendered ?? fallback
  )
}
