-- migrate:up
-- ─────────────────────────────────────────────────────────────────────────────
-- Sleepy Spinner — the whole schema, as of the move off Supabase.
--
-- This folds the seven Supabase migrations into one, because the new database
-- starts empty: replaying renamed methods and retired units would only rebuild
-- what is written out directly here. Later changes go in new files:
-- `npm run db:new -- <name>`.
--
-- Ownership. Every table that holds your data carries the id of the account
-- that owns it. The API, not the browser, is what reaches this database, and
-- it scopes every query to the signed-in account. Where one of your rows points
-- at another — a tick at an ingredient, a pantry entry at an ingredient — the
-- foreign key includes user_id as well, so the database itself refuses a row
-- that points at someone else's.
--
-- user_id is the account's id from the irmahs.dev account service
-- (irmahs-labs/auth), a UUID. Accounts live in that service's own database,
-- so no foreign key reaches them from here; the API takes the id from the
-- signed-in session and nowhere else.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Reference data ───────────────────────────────────────────────────────────
-- Shared by everyone, so no user_id. Ids are written out rather than
-- generated, so `default 1` keeps meaning what it means here and a code can be
-- renamed without orphaning rows.

-- The three reels.
create table public.meal_planner_categories (
  id smallint primary key,
  code text not null unique,
  label text not null,
  -- Left to right on the draw screen.
  position smallint not null unique
);

insert into public.meal_planner_categories (id, code, label, position) values
  (1, 'protein', 'Protein', 1),
  (2, 'vegetable', 'Vegetables', 2),
  (3, 'starch', 'Starch', 3);

-- Each category has its own kinds, and they are genuinely different shapes —
-- which is why these are three tables and not one. A protein kind decides what
-- the diet filters do with it; a vegetable kind carries the word its dish name
-- uses; a starch kind decides the shape of the dish and whether it has gluten.

create table public.meal_planner_protein_kinds (
  id smallint primary key,
  code text not null unique,
  label text not null,
  examples text not null default '',
  -- 'meat' | 'fish' | 'veg' — what the Vegetarian and Pescatarian filters read.
  diet text not null check (diet in ('meat', 'fish', 'veg')),
  is_red_meat boolean not null default false
);

insert into public.meal_planner_protein_kinds (id, code, label, examples, diet, is_red_meat) values
  (1, 'red', 'Red meat', 'Beef, lamb, goat', 'meat', true),
  (2, 'white', 'White meat', 'Pork, veal', 'meat', false),
  (3, 'game', 'Game', 'Venison, rabbit, wild boar, bison', 'meat', true),
  (4, 'poultry', 'Poultry', 'Chicken, turkey, duck', 'meat', false),
  (5, 'fish', 'Fish', 'Salmon, tuna, cod', 'fish', false),
  (6, 'seafood', 'Seafood', 'Prawns, mussels, squid', 'fish', false),
  (7, 'eggdairy', 'Eggs & dairy', 'Eggs, halloumi, paneer', 'veg', false),
  (8, 'plant', 'Plant-based', 'Tofu, tempeh, beans, lentils', 'veg', false);

create table public.meal_planner_vegetable_kinds (
  id smallint primary key,
  code text not null unique,
  label text not null,
  examples text not null default '',
  -- How this vegetable is described in a dish name: "charred broccoli".
  cooking_word text not null
);

insert into public.meal_planner_vegetable_kinds (id, code, label, examples, cooking_word) values
  (1, 'leafy', 'Leafy greens', 'Spinach, kale, chard, lettuce', 'wilted'),
  (2, 'brassica', 'Brassicas', 'Broccoli, cauliflower, cabbage', 'charred'),
  (3, 'root', 'Roots', 'Carrot, beetroot, parsnip', 'roasted'),
  (4, 'fruiting', 'Fruiting', 'Peppers, tomato, zucchini, aubergine', 'blistered'),
  (5, 'pods', 'Pods & legumes', 'Green beans, peas, edamame', 'garlicky'),
  (6, 'allium', 'Alliums', 'Onion, leek, fennel', 'caramelised'),
  (7, 'mushroom', 'Mushrooms', 'Shiitake, oyster, chestnut', 'seared');

-- The shape a dish takes, decided by its starch. `name_template` is the whole
-- sentence a dish name is built from; the app fills the placeholders and knows
-- no wording of its own. Placeholders, any of which may be left out:
--
--   {method}            the protein's cooking method, as stored: "Air-fried"
--   {protein}           the protein's short name: "Chicken"
--   {starch}            the starch's short name: "Rice"
--   {starch_method}     the starch's cooking method, lower case: "steamed"
--   {vegetable}         the vegetable's short name, lower case: "broccoli"
--   {vegetable_method}  the vegetable's cooking method, lower case, or its kind's
--                       cooking_word when none of its methods is in rotation
--
-- A placeholder with nothing to fill it disappears along with its extra space,
-- and the first letter of the result is capitalised.
create table public.meal_planner_dish_styles (
  id smallint primary key,
  code text not null unique,
  label text not null,
  name_template text not null
);

insert into public.meal_planner_dish_styles (id, code, label, name_template) values
  (1, 'bowl', 'Rice bowl', '{method} {protein} {starch} Bowl with {vegetable_method} {vegetable}'),
  (2, 'noodles', 'Noodle bowl', '{method} {protein} {starch} Stir-Fry with {vegetable_method} {vegetable}'),
  (3, 'salad', 'Salad bowl', '{method} {protein} & {starch} Salad with {vegetable_method} {vegetable}'),
  (4, 'tacos', 'Tacos', '{method} {protein} Tacos with {vegetable_method} {vegetable}'),
  (5, 'skillet', 'Skillet', '{method} {protein} {starch} Skillet with {vegetable_method} {vegetable}'),
  (6, 'roast', 'Roasting tray', '{method} {protein} & {starch_method} {starch} Tray with {vegetable_method} {vegetable}');

create table public.meal_planner_starch_kinds (
  id smallint primary key,
  code text not null unique,
  label text not null,
  examples text not null default '',
  -- The shape of the finished dish, which picks the name template and the icon.
  id_dish_style smallint not null references public.meal_planner_dish_styles,
  -- The default for a new ingredient of this kind; the ingredient may override it.
  gluten_free boolean not null default false
);

insert into public.meal_planner_starch_kinds (id, code, label, examples, id_dish_style, gluten_free) values
  (1, 'grain', 'Grains', 'Rice, farro, quinoa, bulgur', 1, true),
  (2, 'noodle', 'Noodles', 'Udon, rice noodles, soba', 2, false),
  (3, 'bread', 'Bread', 'Sourdough, ciabatta, naan', 5, false),
  (4, 'wraps', 'Wraps', 'Tortillas, pita, flatbread', 4, false),
  (5, 'tuber', 'Potatoes & roots', 'Potato, sweet potato, polenta', 6, true),
  (6, 'wholegrain', 'Whole grains', 'Farro, quinoa, bulgur, couscous', 3, false);

-- How much of something. A quantity is always a number and one of these.
--
-- A serving is one of the unit (one egg, one can) unless the unit is a weight
-- or a volume. Those size a serving in their small unit — stock rice in
-- kilograms and a serving is still "75 g" — so the app converts without
-- knowing any unit by name. Ids 8–10 and 12 belonged to retired units.
create table public.meal_planner_units (
  id smallint primary key,
  code text not null unique,
  label text not null,
  -- A count reads as "×8"; anything else as "600 g".
  is_count boolean not null default false,
  -- The unit a new item starts on. Exactly one row should say so.
  is_default boolean not null default false,
  default_serving numeric check (default_serving > 0),
  id_serving_unit smallint references public.meal_planner_units,
  serving_factor numeric not null default 1 check (serving_factor > 0)
);

comment on column public.meal_planner_units.default_serving is
  'What a serving starts at when something is stocked in this unit, in its serving unit. Null: the unit is its own serving (one piece, one can).';
comment on column public.meal_planner_units.id_serving_unit is
  'The unit a serving is sized in when stocking in this one: grams for kilograms, millilitres for litres. Null for units that are their own serving.';
comment on column public.meal_planner_units.serving_factor is
  'How many serving units make one of this unit: 1000 for kilograms, 1 for grams.';

insert into public.meal_planner_units
  (id, code, label, is_count, is_default, default_serving, id_serving_unit, serving_factor) values
  (1, 'piece', 'pieces', true, true, null, null, 1),
  (2, 'g', 'grams', false, false, 150, 2, 1),
  (3, 'kg', 'kilograms', false, false, 150, 2, 1000),
  (4, 'ml', 'millilitres', false, false, 250, 4, 1),
  (5, 'l', 'litres', false, false, 250, 4, 1000),
  (6, 'serving', 'servings', false, false, null, null, 1),
  (7, 'bag', 'bags', false, false, null, null, 1),
  (11, 'can', 'cans', false, false, null, null, 1);

-- Cooking methods. `phrase` is the past participle the dish name uses, which is
-- why this is a table and not a list of words in the app: "Air-fry" has to
-- become "Air-fried", and no rule gets that right for every entry. It has to
-- read as a word before a food, which is why Soup's is "Simmered".
create table public.meal_planner_cooking_methods (
  id smallint primary key,
  code text not null unique,
  label text not null,
  phrase text not null
);

insert into public.meal_planner_cooking_methods (id, code, label, phrase) values
  (1, 'roast', 'Roast', 'Roasted'),
  (2, 'stir_fry', 'Stir-fry', 'Stir-fried'),
  (3, 'pan_fry', 'Pan-fry', 'Pan-fried'),
  (4, 'grill', 'Grill', 'Grilled'),
  (5, 'smoke', 'Smoke', 'Smoked'),
  (6, 'steam', 'Steam', 'Steamed'),
  (7, 'bake', 'Bake', 'Baked'),
  (8, 'air_fry', 'Air-fry', 'Air-fried'),
  (9, 'deep_fry', 'Deep-fry', 'Deep-fried'),
  (10, 'soup', 'Soup', 'Simmered');

-- The chips on the Reel rules screen. Each rule is described by what it keeps
-- off the reels, in terms of the kind columns above, so the app applies any row
-- here without knowing any rule by name.
create table public.meal_planner_diet_rules (
  id smallint primary key,
  code text not null unique,
  label text not null,
  -- Protein kinds whose `diet` is in this list are kept off.
  excludes_diets text[] not null default '{}',
  -- Protein kinds with is_red_meat are kept off.
  excludes_red_meat boolean not null default false,
  -- Starches that are not gluten-free are kept off.
  requires_gluten_free boolean not null default false
);

insert into public.meal_planner_diet_rules
  (id, code, label, excludes_diets, excludes_red_meat, requires_gluten_free) values
  (1, 'vegetarian', 'Vegetarian', '{meat,fish}', false, false),
  (2, 'pescatarian', 'Pescatarian', '{meat}', false, false),
  (3, 'no_red_meat', 'No red meat', '{}', true, false),
  (4, 'gluten_free', 'Gluten-free', '{}', false, true);


-- ── Your data ────────────────────────────────────────────────────────────────

-- Your ingredient list. Everything else points at a row here, so a name is
-- stored once. The category says which reel it spins on; the kind says what it
-- contributes to a dish name and what the diet filters make of it.
--
-- The kind lives in one of three columns because the three kind tables hold
-- different columns. Exactly one is set, and it has to be the one matching the
-- category — which is what the check below enforces, so a starch can never
-- carry a protein's kind.
create table public.meal_planner_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  -- What the dish name calls it: "Chicken Thighs" cooks as "Chicken". Null means
  -- the full name reads fine on its own, which is true of most vegetables.
  short_name text,
  id_category smallint not null references public.meal_planner_categories,
  id_protein_kind smallint references public.meal_planner_protein_kinds,
  id_vegetable_kind smallint references public.meal_planner_vegetable_kinds,
  id_starch_kind smallint references public.meal_planner_starch_kinds,
  -- Starches only: the kind supplies the default, this is the ingredient's own
  -- answer. Null everywhere else.
  gluten_free boolean,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  -- What the tables below point at, so a reference is to your ingredient.
  unique (id, user_id),
  constraint kind_matches_category check (
    case id_category
      when 1 then id_protein_kind is not null
               and id_vegetable_kind is null and id_starch_kind is null
      when 2 then id_vegetable_kind is not null
               and id_protein_kind is null and id_starch_kind is null
      when 3 then id_starch_kind is not null
               and id_protein_kind is null and id_vegetable_kind is null
      else false
    end
  )
);

-- The ways you said an ingredient can be cooked, ticked on Add ingredient. A dish
-- is only ever named after a method ticked here: the protein's gives {method},
-- the vegetable's {vegetable_method}, the starch's {starch_method}.
create table public.meal_planner_ingredient_methods (
  user_id uuid not null,
  id_ingredient uuid not null,
  id_method smallint not null references public.meal_planner_cooking_methods,
  primary key (id_ingredient, id_method),
  foreign key (id_ingredient, user_id)
    references public.meal_planner_ingredients (id, user_id) on delete cascade
);

-- What is actually in the pantry, and when it goes off. The reels are built from
-- this table alone — an ingredient you own but have not stocked never spins.
create table public.meal_planner_pantry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  id_ingredient uuid not null,
  quantity numeric not null default 1 check (quantity >= 0),
  id_unit smallint not null default 1 references public.meal_planner_units,
  -- A date, not a countdown, so days remaining keep shrinking while the app is
  -- closed. The reels weight an ingredient off this column alone.
  date_expiration date not null,
  created_at timestamptz not null default now(),
  -- Cooking takes one serving off; cooking the last one removes the item.
  serving_size numeric not null default 1 check (serving_size > 0),
  unique (user_id, id_ingredient),
  foreign key (id_ingredient, user_id)
    references public.meal_planner_ingredients (id, user_id) on delete cascade
);

comment on column public.meal_planner_pantry.serving_size is
  'How much one serving is, in the serving unit of id_unit (grams for kilograms, millilitres for litres), or 1 for a unit that is its own serving.';

-- Which methods are in rotation. A row exists only for a method you have turned
-- off, so an untouched account has every method available.
create table public.meal_planner_method_settings (
  user_id uuid not null,
  id_method smallint not null references public.meal_planner_cooking_methods,
  enabled boolean not null default true,
  primary key (user_id, id_method)
);

create table public.meal_planner_shopping_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  id_ingredient uuid not null,
  quantity numeric not null default 1 check (quantity >= 0),
  id_unit smallint not null default 1 references public.meal_planner_units,
  -- Why it is on the list, for the line under the name.
  note text not null default '',
  acquired boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, id_ingredient),
  foreign key (id_ingredient, user_id)
    references public.meal_planner_ingredients (id, user_id) on delete cascade
);

-- What was cooked, and when. "Into the pot" writes a row here, and the Draw
-- screen reads yesterday's back as "Yesterday you ate …". The Cooked screen
-- that lists all of it is still switched off (FEATURES.history in
-- src/features.ts); recording does not wait on it.
create table public.meal_planner_history (
  -- Client-generated so the app can diff its own rows without a round trip.
  id uuid primary key,
  user_id uuid not null,
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
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- Which ingredients a meal was drawn from. Both the meal and the ingredient
-- have to be yours.
create table public.meal_planner_history_ingredients (
  user_id uuid not null,
  id_history uuid not null,
  id_ingredient uuid not null,
  primary key (id_history, id_ingredient),
  foreign key (id_history, user_id)
    references public.meal_planner_history (id, user_id) on delete cascade,
  foreign key (id_ingredient, user_id)
    references public.meal_planner_ingredients (id, user_id) on delete cascade
);


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- The unique constraints above already index (user_id, id_ingredient),
-- (user_id, name) and (id, user_id); these cover the reads those do not.

create index meal_planner_ingredients_user_category_idx
  on public.meal_planner_ingredients (user_id, id_category);
create index meal_planner_ingredient_methods_user_idx
  on public.meal_planner_ingredient_methods (user_id);
create index meal_planner_pantry_user_expiry_idx
  on public.meal_planner_pantry (user_id, date_expiration);
create index meal_planner_shopping_list_user_created_idx
  on public.meal_planner_shopping_list (user_id, created_at desc);
create index meal_planner_history_user_date_idx
  on public.meal_planner_history (user_id, date_cooked desc, created_at desc);
create index meal_planner_history_ingredients_ingredient_idx
  on public.meal_planner_history_ingredients (id_ingredient);


-- migrate:down

drop table public.meal_planner_history_ingredients;
drop table public.meal_planner_history;
drop table public.meal_planner_shopping_list;
drop table public.meal_planner_method_settings;
drop table public.meal_planner_pantry;
drop table public.meal_planner_ingredient_methods;
drop table public.meal_planner_ingredients;
drop table public.meal_planner_diet_rules;
drop table public.meal_planner_cooking_methods;
drop table public.meal_planner_units;
drop table public.meal_planner_starch_kinds;
drop table public.meal_planner_dish_styles;
drop table public.meal_planner_vegetable_kinds;
drop table public.meal_planner_protein_kinds;
drop table public.meal_planner_categories;
