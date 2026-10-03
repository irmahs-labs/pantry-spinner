-- migrate:up
-- ─────────────────────────────────────────────────────────────────────────────
-- The demo pantry "Have a look around" starts from.
--
-- Four tables mirroring the ones a real account uses — ingredients, their
-- ticked methods, the pantry, the shopping list — but with no user_id, because
-- nobody owns them. They are reference data like the vocabulary: readable by
-- anyone, writable by no one. A guest's tab copies them in when it opens, and
-- from then on works on its own copy in sessionStorage; nothing here changes.
--
-- Use-by dates are stored as days from now rather than dates, so the demo is
-- as fresh the day someone opens it as the day it was written.
--
-- To change the demo, write a migration that edits these rows. A signed-in
-- account never sees them.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.meal_planner_demo_ingredients (
  id smallint primary key,
  name text not null unique,
  short_name text,
  id_category smallint not null references public.meal_planner_categories,
  id_protein_kind smallint references public.meal_planner_protein_kinds,
  id_vegetable_kind smallint references public.meal_planner_vegetable_kinds,
  id_starch_kind smallint references public.meal_planner_starch_kinds,
  gluten_free boolean,
  -- The same rule a real ingredient obeys: one kind, the one its category takes.
  constraint demo_kind_matches_category check (
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

create table public.meal_planner_demo_ingredient_methods (
  id_demo_ingredient smallint not null
    references public.meal_planner_demo_ingredients on delete cascade,
  id_method smallint not null references public.meal_planner_cooking_methods,
  primary key (id_demo_ingredient, id_method)
);

create table public.meal_planner_demo_pantry (
  id_demo_ingredient smallint primary key
    references public.meal_planner_demo_ingredients on delete cascade,
  quantity numeric not null check (quantity > 0),
  id_unit smallint not null references public.meal_planner_units,
  -- Days from the moment the demo opens. 0 is today.
  days_left smallint not null check (days_left >= 0),
  -- In the serving unit of id_unit, as for a real pantry row.
  serving_size numeric not null default 1 check (serving_size > 0)
);

create table public.meal_planner_demo_shopping_list (
  id_demo_ingredient smallint primary key
    references public.meal_planner_demo_ingredients on delete cascade,
  quantity numeric not null check (quantity > 0),
  id_unit smallint not null references public.meal_planner_units,
  note text not null default ''
);

-- Rows are written against codes rather than ids, so this file reads as a
-- pantry and survives an id being renumbered in the vocabulary.
--
-- The set is chosen to show the machine working on the first draw: every reel
-- has something, two things are close to going off so the weighting shows,
-- one vegetable has no methods ticked so its kind's word shows, and two
-- ingredients are described but not stocked, one of them on the list.

with rows(id, name, short_name, category, kind, gluten_free) as (values
  (1,  'Chicken Thighs', 'Chicken',  'protein',   'poultry',  null::boolean),
  (2,  'Firm Tofu',      'Tofu',     'protein',   'plant',    null),
  (3,  'Eggs',           'Egg',      'protein',   'eggdairy', null),
  (4,  'Salmon Fillet',  'Salmon',   'protein',   'fish',     null),
  (5,  'Broccoli',       null,       'vegetable', 'brassica', null),
  (6,  'Baby Spinach',   'spinach',  'vegetable', 'leafy',    null),
  (7,  'Mushrooms',      null,       'vegetable', 'mushroom', null),
  (8,  'Jasmine Rice',   'Rice',     'starch',    'grain',    true),
  (9,  'Corn Tortillas', 'Tortilla', 'starch',    'wraps',    true),
  (10, 'Sweet Potato',   null,       'starch',    'tuber',    true)
)
insert into public.meal_planner_demo_ingredients
  (id, name, short_name, id_category, id_protein_kind, id_vegetable_kind, id_starch_kind, gluten_free)
select r.id, r.name, r.short_name, c.id, pk.id, vk.id, sk.id, r.gluten_free
from rows r
join public.meal_planner_categories c on c.code = r.category
left join public.meal_planner_protein_kinds pk on r.category = 'protein' and pk.code = r.kind
left join public.meal_planner_vegetable_kinds vk on r.category = 'vegetable' and vk.code = r.kind
left join public.meal_planner_starch_kinds sk on r.category = 'starch' and sk.code = r.kind;

-- Baby Spinach is left without ticks on purpose: its dishes say "wilted",
-- the word its kind carries.
insert into public.meal_planner_demo_ingredient_methods (id_demo_ingredient, id_method)
select t.ingredient, m.id
from (values
  (1, 'air_fry'), (1, 'bake'), (1, 'pan_fry'),
  (2, 'pan_fry'), (2, 'stir_fry'),
  (3, 'deep_fry'), (3, 'pan_fry'),
  (4, 'grill'), (4, 'bake'),
  (5, 'roast'), (5, 'steam'),
  (7, 'pan_fry'), (7, 'roast'),
  (8, 'steam'),
  (10, 'roast'), (10, 'bake')
) as t(ingredient, method)
join public.meal_planner_cooking_methods m on m.code = t.method;

-- Serving sizes are in grams for anything stocked by weight: the chicken is
-- three servings, the tofu two, the mushrooms two, the rice twenty.
insert into public.meal_planner_demo_pantry (id_demo_ingredient, quantity, id_unit, days_left, serving_size)
select p.ingredient, p.quantity, u.id, p.days_left, p.serving_size
from (values
  (1,  600, 'g',     2,  200),
  (2,  400, 'g',     6,  200),
  (3,  8,   'piece', 9,  1),
  (6,  1,   'bag',   1,  1),
  (7,  250, 'g',     4,  125),
  (8,  1.5, 'kg',    90, 75),
  (9,  10,  'piece', 12, 1),
  (10, 3,   'piece', 20, 1)
) as p(ingredient, quantity, unit, days_left, serving_size)
join public.meal_planner_units u on u.code = p.unit;

insert into public.meal_planner_demo_shopping_list (id_demo_ingredient, quantity, id_unit, note)
select l.ingredient, l.quantity, u.id, l.note
from (values
  (5, 1,   'piece', 'Drawn twice, never in stock'),
  (4, 300, 'g',     'For the weekend')
) as l(ingredient, quantity, unit, note)
join public.meal_planner_units u on u.code = l.unit;


-- migrate:down

drop table public.meal_planner_demo_shopping_list;
drop table public.meal_planner_demo_pantry;
drop table public.meal_planner_demo_ingredient_methods;
drop table public.meal_planner_demo_ingredients;
