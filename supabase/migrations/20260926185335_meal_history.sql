-- What was cooked, and when. "Into the pot" writes a row here, and the Draw
-- screen reads yesterday's back as "Yesterday you ate …".
--
-- The Cooked screen that lists all of it is still switched off
-- (FEATURES.history in src/features.ts); recording no longer waits on it.

create table if not exists public.meal_planner_history (
  -- Client-generated so the app can diff its own rows without a round trip.
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name_meal text not null,
  note text not null default '',
  -- The shape the dish was drawn as, so its icon survives later changes to the
  -- ingredients. A reference by code, so a style can be renamed without the
  -- app or this table knowing any style by name.
  dish_style text references public.meal_planner_dish_styles (code)
    on update cascade on delete set null,
  id_method smallint references public.meal_planner_cooking_methods
    on delete set null,
  date_cooked date not null default current_date,
  created_at timestamptz not null default now()
);

-- Which ingredients a meal was drawn from.
create table if not exists public.meal_planner_history_ingredients (
  id_history uuid not null references public.meal_planner_history on delete cascade,
  id_ingredient uuid not null
    references public.meal_planner_ingredients on delete cascade,
  primary key (id_history, id_ingredient)
);

create index if not exists meal_planner_history_user_date_idx
  on public.meal_planner_history (user_id, date_cooked desc, created_at desc);
create index if not exists meal_planner_history_ingredients_ingredient_idx
  on public.meal_planner_history_ingredients (id_ingredient);


-- ── Grants ───────────────────────────────────────────────────────────────────
-- Explicit, as for every table since Supabase's 30 October change: signed-in
-- users only, narrowed to their own rows by RLS below; nothing for anon.

revoke all on table
  public.meal_planner_history, public.meal_planner_history_ingredients
from anon, authenticated;

grant select, insert, update, delete on table
  public.meal_planner_history, public.meal_planner_history_ingredients
to authenticated;

grant select, insert, update, delete on table
  public.meal_planner_history, public.meal_planner_history_ingredients
to service_role;


-- ── Row-level security ───────────────────────────────────────────────────────

alter table public.meal_planner_history enable row level security;
alter table public.meal_planner_history_ingredients enable row level security;

drop policy if exists "own meal_planner_history" on public.meal_planner_history;
create policy "own meal_planner_history" on public.meal_planner_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The link table has no user_id of its own: a row is yours when the meal it
-- hangs off is yours, and the ingredient is yours too.
drop policy if exists "own history ingredients" on public.meal_planner_history_ingredients;
create policy "own history ingredients" on public.meal_planner_history_ingredients
  for all to authenticated
  using (
    exists (
      select 1 from public.meal_planner_history h
      where h.id = id_history and h.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meal_planner_history h
      where h.id = id_history and h.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.meal_planner_ingredients i
      where i.id = id_ingredient and i.user_id = (select auth.uid())
    )
  );
