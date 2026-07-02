// TTC saisi -> HT stocke, arrondi vers le bas au centime pour que le TTC rond
// ressorte juste apres l'arrondi ceil-a-l'euro du devis. +1e-9 = garde flottante.
export function deriveHtFromTtc(ttc: number, tvaRate: number): number {
  const rate = tvaRate || 0
  if (rate <= -100) return 0
  return Math.floor((ttc / (1 + rate / 100)) * 100 + 1e-9) / 100
}

// Les taux de TVA sont stockes en pourcentage (20 = 20%). Une valeur dans ]0,1[
// vient d'une saisie ou d'un import en fraction (0.2 pour 20%) : on la ramene en
// pourcentage. Aucun taux FR valide n'est entre 0 et 1, donc 0 reste 0 (exonere)
// et tout taux >= 1 passe tel quel.
export function normalizeTvaRate(rate: number): number {
  return rate > 0 && rate < 1 ? rate * 100 : rate
}
