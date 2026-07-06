// Les taux de TVA sont stockes en pourcentage (20 = 20%). Une valeur dans ]0,1[
// vient d'une saisie ou d'un import en fraction (0.2 pour 20%) : on la ramene en
// pourcentage. Aucun taux FR valide n'est entre 0 et 1, donc 0 reste 0 (exonere)
// et tout taux >= 1 passe tel quel.
export function normalizeTvaRate(rate: number): number {
  return rate > 0 && rate < 1 ? rate * 100 : rate
}
