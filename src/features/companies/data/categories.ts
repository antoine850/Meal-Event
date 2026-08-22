type CompanyCategory =
  | 'agence'
  | 'finance_banque'
  | 'mode_luxe'
  | 'tech'
  | 'industrie'
  | 'sante_pharma'
  | 'associatif'
  | 'collectivite'
  | 'btp'
  | 'autre'

// Ordre d'affichage du select et du filtre. Ajouter une valeur se fait ici
// (union + liste), sans migration : la colonne est un simple texte. Renommer
// un slug apres coup n'est plus gratuit, les lignes gardent l'ancienne valeur.
export const COMPANY_CATEGORIES: { value: CompanyCategory; label: string }[] = [
  { value: 'agence', label: 'Agence' },
  { value: 'finance_banque', label: 'Finance / Banque' },
  { value: 'mode_luxe', label: 'Mode / Luxe' },
  { value: 'tech', label: 'Tech' },
  { value: 'industrie', label: 'Industrie' },
  { value: 'sante_pharma', label: 'Santé / Pharma' },
  { value: 'associatif', label: 'Associatif' },
  { value: 'collectivite', label: 'Collectivité' },
  { value: 'btp', label: 'BTP' },
  { value: 'autre', label: 'Autre' },
]

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  COMPANY_CATEGORIES.map((c) => [c.value, c.label])
)
