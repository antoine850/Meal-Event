// Pendant JS de f_unaccent côté SQL : accents, casse et espaces superflus ignorés
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// true si chaque mot du terme apparaît dans l'un des champs (ordre libre)
export function matchesSearch(
  term: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const q = normalizeSearch(term)
  if (!q) return true
  const haystack = normalizeSearch(fields.filter(Boolean).join(' '))
  return q.split(' ').every((w) => haystack.includes(w))
}
