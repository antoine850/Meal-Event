export type BadgeType =
  | 'relance_devis'
  | 'relance_facture'
  | 'relance_acompte'
  | 'retour_experience'
  | 'litige'

// Rouge tant que pas traite (FX). Le litige est desactive cote SQL en v1.
export const BADGE_CONFIG: Record<
  BadgeType,
  { label: string; className: string }
> = {
  relance_devis: {
    label: 'Relancer devis',
    className: 'border-red-500/60 text-red-600 dark:text-red-400',
  },
  relance_facture: {
    label: 'Relancer facture',
    className: 'border-red-500/60 text-red-600 dark:text-red-400',
  },
  relance_acompte: {
    label: 'Relancer acompte',
    className: 'border-red-500/60 text-red-600 dark:text-red-400',
  },
  retour_experience: {
    label: "Retour d'expérience",
    className: 'border-amber-500/60 text-amber-600 dark:text-amber-400',
  },
  litige: {
    label: 'Litige',
    className: 'border-red-700/60 text-red-700 dark:text-red-400',
  },
}
