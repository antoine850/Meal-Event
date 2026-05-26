/**
 * Calcul d'heures ouvrées entre deux instants UTC.
 *
 * Règles :
 *   - Fuseau de référence : Europe/Paris (DST CET/CEST géré via Intl)
 *   - Heures ouvrées : Lun-Ven 9h00 → 17h00 (heure locale Paris)
 *   - Weekend exclu (Sam-Dim)
 *   - Jours fériés français : non gérés (pas dans le scope)
 *   - Pause déjeuner : comptée comme ouvrée (continue 9-17)
 */

const PARIS_TZ = 'Europe/Paris'
const WEEKDAY_CODES = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
const WORK_START_HOUR = 9
const WORK_END_HOUR = 17
const MS_PER_HOUR = 1000 * 60 * 60

const parisPartsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  weekday: 'short',
})

type ParisParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  weekday: string // 'Mon', 'Tue', ...
}

function getParisParts(d: Date): ParisParts {
  const parts = parisPartsFmt.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  // Intl peut retourner "24" pour minuit dans certains environnements — normaliser
  const hour = +map.hour === 24 ? 0 : +map.hour
  return {
    year: +map.year,
    month: +map.month,
    day: +map.day,
    hour,
    minute: +map.minute,
    second: +map.second,
    weekday: map.weekday,
  }
}

/**
 * Convertit une horloge murale Paris (y/m/d/h/mi) en instant UTC.
 * Gère DST en itérant : on essaie un offset, on vérifie, on corrige si on est tombé
 * dans le mauvais côté d'une transition.
 */
function parisWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  // Première estimation : interpréter comme si c'était UTC
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute)
  // Voir quelle heure Paris donnerait pour cet instant naïf
  const naiveParis = getParisParts(new Date(naiveUtc))
  // Différence en minutes entre ce que Paris affiche et ce qu'on voulait
  const wantedMin = year * 525600 + month * 43800 + day * 1440 + hour * 60 + minute
  const gotMin =
    naiveParis.year * 525600 +
    naiveParis.month * 43800 +
    naiveParis.day * 1440 +
    naiveParis.hour * 60 +
    naiveParis.minute
  const offsetMin = gotMin - wantedMin
  let result = naiveUtc - offsetMin * 60 * 1000
  // Itération de sécurité (cas transition DST où l'offset varie)
  const check = getParisParts(new Date(result))
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.hour !== hour ||
    check.minute !== minute
  ) {
    const checkMin =
      check.year * 525600 +
      check.month * 43800 +
      check.day * 1440 +
      check.hour * 60 +
      check.minute
    result -= (checkMin - wantedMin) * 60 * 1000
  }
  return new Date(result)
}

/**
 * Calcule le nombre d'heures ouvrées (Lun-Ven 9-17 Europe/Paris) entre start et end.
 * Retourne 0 si end <= start.
 */
export function computeWorkingHoursBetween(start: Date, end: Date): number {
  if (end <= start) return 0

  let total = 0
  // On parcourt jour par jour en se basant sur le calendrier Paris
  const startParts = getParisParts(start)
  let cursorY = startParts.year
  let cursorM = startParts.month
  let cursorD = startParts.day

  while (true) {
    const dayStart = parisWallTimeToUtc(cursorY, cursorM, cursorD, 0, 0)
    if (dayStart.getTime() >= end.getTime()) break

    const dayParts = getParisParts(dayStart)
    if (WEEKDAY_CODES.has(dayParts.weekday)) {
      const workStart = parisWallTimeToUtc(
        cursorY,
        cursorM,
        cursorD,
        WORK_START_HOUR,
        0
      )
      const workEnd = parisWallTimeToUtc(
        cursorY,
        cursorM,
        cursorD,
        WORK_END_HOUR,
        0
      )
      const overlapStart = Math.max(start.getTime(), workStart.getTime())
      const overlapEnd = Math.min(end.getTime(), workEnd.getTime())
      if (overlapEnd > overlapStart) {
        total += (overlapEnd - overlapStart) / MS_PER_HOUR
      }
    }

    // Avancer d'un jour dans le calendrier Paris
    // Astuce : ajouter 1 au jour, JS Date normalise les overflow (32 mai = 1 juin)
    // Mais on travaille en Paris, donc on calcule via parisWallTimeToUtc puis on relit
    const nextDayUtc = parisWallTimeToUtc(cursorY, cursorM, cursorD + 1, 0, 0)
    const nextParts = getParisParts(nextDayUtc)
    cursorY = nextParts.year
    cursorM = nextParts.month
    cursorD = nextParts.day
  }

  return total
}
