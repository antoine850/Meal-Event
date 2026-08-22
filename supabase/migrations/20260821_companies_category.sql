-- Categorie de societe (spec 2026-08-20) : "agence" pour les intermediaires
-- (Rejolt, Business Profilers, Naboo...) et secteur pour les entreprises B2B.
-- Toujours optionnelle. Pas d'index : le filtre est client-side sur un jeu
-- deja charge en memoire par useAllCompanies.
alter table public.companies
  add column if not exists category text;
