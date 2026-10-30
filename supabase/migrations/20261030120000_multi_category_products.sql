-- Add multi-category support without removing the legacy primary category_id column.
create table if not exists public.product_category_assignments (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_category_assignments_pkey primary key (product_id, category_id)
);

create index if not exists product_category_assignments_category_id_idx
  on public.product_category_assignments(category_id);

alter table public.product_category_assignments enable row level security;

drop policy if exists "Public can read product category assignments" on public.product_category_assignments;
create policy "Public can read product category assignments"
  on public.product_category_assignments for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert product category assignments" on public.product_category_assignments;
create policy "Admins can insert product category assignments"
  on public.product_category_assignments for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can delete product category assignments" on public.product_category_assignments;
create policy "Admins can delete product category assignments"
  on public.product_category_assignments for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update product category assignments" on public.product_category_assignments;
create policy "Admins can update product category assignments"
  on public.product_category_assignments for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

grant select on public.product_category_assignments to anon, authenticated;
grant insert, update, delete on public.product_category_assignments to authenticated;

-- Backfill every existing primary category, so existing products keep their current category membership.
insert into public.product_category_assignments (product_id, category_id)
select id, category_id
from public.products
where category_id is not null
on conflict (product_id, category_id) do nothing;
