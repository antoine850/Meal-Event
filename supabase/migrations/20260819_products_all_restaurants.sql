-- Option "tous les restaurants" sur un produit : visible dans tous les restos
-- (y compris crees plus tard) sans lignes de jonction product_restaurants.
-- Zero restaurant coche reste = invisible dans les devis (inchange).
alter table public.products
  add column if not exists all_restaurants boolean not null default false;
