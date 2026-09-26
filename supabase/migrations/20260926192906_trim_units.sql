-- Four units retired: bunch, pot, block and pack. What remains is pieces,
-- servings, bags and cans, plus grams, kilograms, millilitres and litres.
--
-- Anything stocked or listed in a retired unit moves to pieces first, one for
-- one, since each of them counted whole things too; the rows' foreign keys
-- would refuse the delete otherwise.

-- The demo tofu was one block; by weight it gets a serving size that means
-- something.
update public.meal_planner_demo_pantry
set quantity = 400,
    id_unit = (select id from public.meal_planner_units where code = 'g'),
    serving_size = 200
where id_demo_ingredient = 2
  and id_unit = (select id from public.meal_planner_units where code = 'block');

update public.meal_planner_pantry
set id_unit = (select id from public.meal_planner_units where code = 'piece')
where id_unit in (
  select id from public.meal_planner_units where code in ('bunch', 'pot', 'block', 'pack')
);

update public.meal_planner_shopping_list
set id_unit = (select id from public.meal_planner_units where code = 'piece')
where id_unit in (
  select id from public.meal_planner_units where code in ('bunch', 'pot', 'block', 'pack')
);

update public.meal_planner_demo_pantry
set id_unit = (select id from public.meal_planner_units where code = 'piece')
where id_unit in (
  select id from public.meal_planner_units where code in ('bunch', 'pot', 'block', 'pack')
);

update public.meal_planner_demo_shopping_list
set id_unit = (select id from public.meal_planner_units where code = 'piece')
where id_unit in (
  select id from public.meal_planner_units where code in ('bunch', 'pot', 'block', 'pack')
);

delete from public.meal_planner_units
where code in ('bunch', 'pot', 'block', 'pack');
