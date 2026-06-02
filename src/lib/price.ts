// TTC saisi -> HT stocke, arrondi vers le bas au centime pour que le TTC rond
// ressorte juste apres l'arrondi ceil-a-l'euro du devis. +1e-9 = garde flottante.
export function deriveHtFromTtc(ttc: number, tvaRate: number): number {
  const rate = tvaRate || 0
  if (rate <= -100) return 0
  return Math.floor((ttc / (1 + rate / 100)) * 100 + 1e-9) / 100
}
