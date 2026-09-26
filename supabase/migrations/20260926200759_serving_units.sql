-- A serving is sized in the small unit: stock rice in kilograms, and a serving
-- of it is still "75 g", not "0.075 kg". Litres pair with millilitres the same
-- way. Grams and millilitres are their own serving unit.
--
-- Which unit a serving is measured in, and how many of it make one of the
-- stocked unit, are columns here, so the app converts without knowing any unit
-- by name.

alter table public.meal_planner_units
  add column if not exists id_serving_unit smallint
    references public.meal_planner_units,
  add column if not exists serving_factor numeric not null default 1
    check (serving_factor > 0);

comment on column public.meal_planner_units.id_serving_unit is
  'The unit a serving is sized in when stocking in this one: grams for kilograms, millilitres for litres. Null for units that are their own serving.';
comment on column public.meal_planner_units.serving_factor is
  'How many serving units make one of this unit: 1000 for kilograms, 1 for grams.';

update public.meal_planner_units u
set id_serving_unit = s.id,
    serving_factor = v.factor
from (values
  ('g',  'g',  1),
  ('kg', 'g',  1000),
  ('ml', 'ml', 1),
  ('l',  'ml', 1000)
) as v(code, serving_code, factor)
join public.meal_planner_units s on s.code = v.serving_code
where u.code = v.code;

-- default_serving is now in the serving unit, so kilograms start on 150 g and
-- litres on 250 ml, the same as grams and millilitres.
update public.meal_planner_units
set default_serving = case code
  when 'g'  then 150
  when 'kg' then 150
  when 'ml' then 250
  when 'l'  then 250
end
where code in ('g', 'kg', 'ml', 'l');

comment on column public.meal_planner_units.default_serving is
  'What a serving starts at when something is stocked in this unit, in its serving unit. Null: the unit is its own serving (one piece, one can).';

-- serving_size moves to the serving unit too: 0.075 against kilograms becomes 75
-- (grams). Rows in grams, millilitres or a counted unit have a factor of 1 and
-- stay as they are.
update public.meal_planner_pantry p
set serving_size = p.serving_size * u.serving_factor
from public.meal_planner_units u
where u.id = p.id_unit and u.serving_factor <> 1;

update public.meal_planner_demo_pantry p
set serving_size = p.serving_size * u.serving_factor
from public.meal_planner_units u
where u.id = p.id_unit and u.serving_factor <> 1;

comment on column public.meal_planner_pantry.serving_size is
  'How much one serving is, in the serving unit of id_unit (grams for kilograms, millilitres for litres), or 1 for a unit that is its own serving.';
