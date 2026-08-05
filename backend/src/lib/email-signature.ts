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
