-- Facture d'avoir : tables credit_notes / credit_note_items, compteur sequentiel
-- atomique, colonnes documents, RPC create_credit_note. RLS org-scopee (meme
-- expression que le reste du schema : organization_id via users/auth.uid()).

create table if not exists public.credit_notes (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  avoir_number text not null,
  issued_at timestamptz not null default now(),
  reason text,
  total_ht numeric not null default 0,
  total_tva numeric not null default 0,
  total_ttc numeric not null default 0,
  old_effective_ttc numeric,
  new_effective_ttc numeric,
  overpaid_ttc numeric not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_credit_notes_quote on public.credit_notes(quote_id);
create index if not exists idx_credit_notes_booking on public.credit_notes(booking_id);
create index if not exists idx_credit_notes_org on public.credit_notes(organization_id);

create table if not exists public.credit_note_items (
  id uuid primary key default uuid_generate_v4(),
  credit_note_id uuid not null references public.credit_notes(id) on delete cascade,
  source_quote_item_id uuid,
  name text not null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  tva_rate numeric not null default 0,
  item_type text not null default 'product',
  total_ht numeric not null default 0,
  total_ttc numeric not null default 0,
  credited_ttc numeric not null default 0
);
create index if not exists idx_credit_note_items_cn on public.credit_note_items(credit_note_id);

create table if not exists public.document_counters (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_id uuid,
  doc_type text not null,
  year int not null,
  last_value int not null default 0
);
-- restaurant_id nullable : un UNIQUE classique traite les NULL comme distincts, ce qui
-- casserait le ON CONFLICT du compteur pour les dossiers sans restaurant. Index sur
-- coalesce(...) pour une cle deterministe qui matche le null.
create unique index if not exists document_counters_key
  on public.document_counters (
    organization_id,
    coalesce(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    doc_type,
    year
  );

alter table public.documents add column if not exists doc_kind text;
alter table public.documents add column if not exists credit_note_id uuid references public.credit_notes(id) on delete set null;

alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;
alter table public.document_counters enable row level security;

create policy "credit_notes org" on public.credit_notes for all
  using (organization_id in (select organization_id from public.users where id = auth.uid()))
  with check (organization_id in (select organization_id from public.users where id = auth.uid()));

create policy "credit_note_items via cn" on public.credit_note_items for all
  using (credit_note_id in (
    select id from public.credit_notes
    where organization_id in (select organization_id from public.users where id = auth.uid())
  ))
  with check (credit_note_id in (
    select id from public.credit_notes
    where organization_id in (select organization_id from public.users where id = auth.uid())
  ));

create policy "document_counters org" on public.document_counters for all
  using (organization_id in (select organization_id from public.users where id = auth.uid()))
  with check (organization_id in (select organization_id from public.users where id = auth.uid()));

-- Cree un avoir de facon atomique : bump du compteur, reduction/suppression des lignes,
-- mise a jour des totaux du devis + figeage de l'acompte, insertion de l'avoir et de ses
-- lignes. Recoit des montants deja calcules (lib d'arrondi partagee cote backend).
create or replace function public.create_credit_note(
  p_organization_id uuid,
  p_restaurant_id uuid,
  p_booking_id uuid,
  p_quote_id uuid,
  p_reason text,
  p_new_total_ht numeric,
  p_new_total_tva numeric,
  p_new_total_ttc numeric,
  p_deposit_override numeric,
  p_avoir_ht numeric,
  p_avoir_tva numeric,
  p_avoir_ttc numeric,
  p_old_effective_ttc numeric,
  p_new_effective_ttc numeric,
  p_overpaid_ttc numeric,
  p_removed_item_ids uuid[],
  p_updated_items jsonb,   -- [{ "id": uuid, "discount_amount": numeric }]
  p_credit_items jsonb,    -- [{ name, description, quantity, unit_price, tva_rate, item_type, total_ht, total_ttc, credited_ttc, source_quote_item_id }]
  p_created_by uuid
) returns public.credit_notes
language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_number text;
  v_cn public.credit_notes;
  v_item jsonb;
begin
  insert into public.document_counters (organization_id, restaurant_id, doc_type, year, last_value)
    values (p_organization_id, p_restaurant_id, 'avoir', v_year, 1)
  on conflict (organization_id, coalesce(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type, year)
    do update set last_value = public.document_counters.last_value + 1
  returning last_value into v_seq;

  v_number := 'AV-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  update public.quotes
    set total_ht = p_new_total_ht,
        total_tva = p_new_total_tva,
        total_ttc = p_new_total_ttc,
        deposit_amount_override = coalesce(p_deposit_override, deposit_amount_override)
    where id = p_quote_id;

  if array_length(p_removed_item_ids, 1) is not null then
    delete from public.quote_items where id = any(p_removed_item_ids);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_updated_items, '[]'::jsonb)) loop
    update public.quote_items
      set discount_amount = (v_item->>'discount_amount')::numeric
      where id = (v_item->>'id')::uuid;
  end loop;

  insert into public.credit_notes (
    organization_id, restaurant_id, booking_id, quote_id, avoir_number, reason,
    total_ht, total_tva, total_ttc, old_effective_ttc, new_effective_ttc, overpaid_ttc, created_by
  ) values (
    p_organization_id, p_restaurant_id, p_booking_id, p_quote_id, v_number, p_reason,
    p_avoir_ht, p_avoir_tva, p_avoir_ttc, p_old_effective_ttc, p_new_effective_ttc, p_overpaid_ttc, p_created_by
  ) returning * into v_cn;

  for v_item in select * from jsonb_array_elements(coalesce(p_credit_items, '[]'::jsonb)) loop
    insert into public.credit_note_items (
      credit_note_id, source_quote_item_id, name, description, quantity, unit_price,
      tva_rate, item_type, total_ht, total_ttc, credited_ttc
    ) values (
      v_cn.id,
      nullif(v_item->>'source_quote_item_id', '')::uuid,
      v_item->>'name', v_item->>'description',
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      (v_item->>'tva_rate')::numeric, coalesce(v_item->>'item_type', 'product'),
      (v_item->>'total_ht')::numeric, (v_item->>'total_ttc')::numeric, (v_item->>'credited_ttc')::numeric
    );
  end loop;

  return v_cn;
end;
$$;
