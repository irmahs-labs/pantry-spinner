-- Three methods swapped for ones cooked more often. Same ids, so every tick on
-- an ingredient and every switched-off setting carries over to the new method.
--
-- The phrase is what a dish name says ("Smoked Salmon …", "with smoked
-- carrots"), so it has to read as a word before a food: Soup's is "Simmered".

update public.meal_planner_cooking_methods
set code = 'smoke', label = 'Smoke', phrase = 'Smoked'
where id = 5;

update public.meal_planner_cooking_methods
set code = 'deep_fry', label = 'Deep-fry', phrase = 'Deep-fried'
where id = 9;

update public.meal_planner_cooking_methods
set code = 'soup', label = 'Soup', phrase = 'Simmered'
where id = 10;
