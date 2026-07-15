// Miroir de buildDocumentName côté backend (backend/src/lib/documents.ts) :
// les fichiers téléchargés par le navigateur doivent porter le même nom que
// les documents CRM. Format : Jourmoisannee_type_restaurant_nomclient.
export function buildDocumentName(
  docType: string,
  restaurantName?: string | null,
  clientName?: string | null
): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
  const d = new Date()
  const date = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`
  return [date, docType, clean(restaurantName || ''), clean(clientName || '')]
    .filter(Boolean)
    .join('_')
}

// nomclient = nom du contact, fallback société
export function clientNameOf(
  contact:
    | {
        last_name?: string | null
        company?: { name?: string | null } | null
      }
    | null
    | undefined
): string | null {
  return contact?.last_name || contact?.company?.name || null
}
