type CancellationReason =
  | 'budget'
  | 'pas_de_dispo'
  | 'concurrent'
  | 'doublon_multi_resto'
  | 'sans_reponse'
  | 'report_client'
  | 'hors_perimetre'
  | 'autre'

// Ordre d'affichage du select. Ajouter un motif se fait ici (union + liste),
// sans migration : la colonne est un simple texte. Renommer un libelle reste
// gratuit, changer un slug ne l'est plus (les lignes gardent l'ancienne valeur).
export const CANCELLATION_REASONS: {
  value: CancellationReason
  label: string
}[] = [
  { value: 'budget', label: 'Budget trop élevé' },
  { value: 'pas_de_dispo', label: 'Pas de dispo à la date' },
  { value: 'concurrent', label: 'Parti chez un concurrent' },
  { value: 'doublon_multi_resto', label: 'Doublon multi-resto' },
  { value: 'sans_reponse', label: 'Sans réponse du client' },
  { value: 'report_client', label: 'Annulé ou reporté par le client' },
  { value: 'hors_perimetre', label: 'Hors périmètre' },
  { value: 'autre', label: 'Autre' },
]

export const CANCELLATION_REASON_LABELS: Record<string, string> =
  Object.fromEntries(CANCELLATION_REASONS.map((r) => [r.value, r.label]))

// Slug du statut d'annulation, unique en base (verifie en prod le 23/08).
// Deja en dur dans PIPELINE_HIDDEN_SLUGS et la vue booking_badges.
export const CANCELLED_SLUG = 'cancelled'
