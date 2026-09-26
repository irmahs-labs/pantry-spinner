-- Cooking uses up a serving. "Into the pot" takes one serving off each drawn
-- ingredient's pantry quantity, and cooking the last serving removes the item.
--
-- A serving is one of the unit (one egg, one can) unless the unit is a weight
-- or a volume, where you say how much a serving is when you stock it. Which
-- units those are, and what a serving starts at, is data here, not code.

alter table public.meal_planner_units
  add column if not exists default_serving numeric check (default_serving > 0);

comment on column public.meal_planner_units.default_serving is
  'What a serving starts at when something is stocked in this unit. Null: the unit is its own serving (one piece, one can).';

update public.meal_planner_units set default_serving = case code
  when 'g'  then 150
  when 'kg' then 0.15
  when 'ml' then 250
  when 'l'  then 0.25
end;

-- In the item's own unit, like its quantity: 200 against "600 g" is a third.
alter table public.meal_planner_pantry
  add column if not exists serving_size numeric not null default 1
    check (serving_size > 0);

-- Anything already stocked by weight or volume starts on its unit's default
-- rather than a serving of one gram.
update public.meal_planner_pantry p
set serving_size = u.default_serving
from public.meal_planner_units u
where u.id = p.id_unit and u.default_serving is not null;

-- The guest demo pantry gets the same column, with servings that make sense
-- for what it holds.
alter table public.meal_planner_demo_pantry
  add column if not exists serving_size numeric not null default 1
    check (serving_size > 0);

update public.meal_planner_demo_pantry d
set serving_size = s.serving_size
from (values
  (1, 200),    -- Chicken Thighs, 600 g: three servings
  (7, 125),    -- Mushrooms, 250 g: two
  (8, 0.075)   -- Jasmine Rice, 1.5 kg: twenty
) as s(ingredient, serving_size)
where d.id_demo_ingredient = s.ingredient;
