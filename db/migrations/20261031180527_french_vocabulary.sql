-- migrate:up
-- ─────────────────────────────────────────────────────────────────────────────
-- The vocabulary in French, for visitors who read the app in French.
--
-- Every word the app shows comes from these tables, so French is a second
-- column beside each English one: label_fr beside label, and so on. A French
-- column left null falls back to the English one (src/data/vocab.ts).
--
-- French dish names put the method after the noun and use phrases that never
-- agree with it ("au four", "à la vapeur"), because an ingredient's name is
-- typed by its owner and its gender is unknown.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.meal_planner_categories add column label_fr text;

update public.meal_planner_categories as t set label_fr = v.label_fr
from (values
  ('protein', 'Protéines'),
  ('vegetable', 'Légumes'),
  ('starch', 'Féculents')
) as v (code, label_fr)
where t.code = v.code;

alter table public.meal_planner_protein_kinds
  add column label_fr text,
  add column examples_fr text;

update public.meal_planner_protein_kinds as t
set label_fr = v.label_fr, examples_fr = v.examples_fr
from (values
  ('red', 'Viande rouge', 'Bœuf, agneau, chèvre'),
  ('white', 'Viande blanche', 'Porc, veau'),
  ('game', 'Gibier', 'Chevreuil, lapin, sanglier, bison'),
  ('poultry', 'Volaille', 'Poulet, dinde, canard'),
  ('fish', 'Poisson', 'Saumon, thon, cabillaud'),
  ('seafood', 'Fruits de mer', 'Crevettes, moules, calamars'),
  ('eggdairy', 'Œufs et laitages', 'Œufs, halloumi, paneer'),
  ('plant', 'Végétal', 'Tofu, tempeh, haricots, lentilles')
) as v (code, label_fr, examples_fr)
where t.code = v.code;

alter table public.meal_planner_vegetable_kinds
  add column label_fr text,
  add column examples_fr text,
  add column cooking_word_fr text;

update public.meal_planner_vegetable_kinds as t
set label_fr = v.label_fr, examples_fr = v.examples_fr,
  cooking_word_fr = v.cooking_word_fr
from (values
  ('leafy', 'Légumes-feuilles', 'Épinards, chou kale, blettes, laitue', 'à l’étuvée'),
  ('brassica', 'Choux', 'Brocoli, chou-fleur, chou', 'à la flamme'),
  ('root', 'Racines', 'Carotte, betterave, panais', 'au four'),
  ('fruiting', 'Légumes-fruits', 'Poivrons, tomate, courgette, aubergine', 'à la plancha'),
  ('pods', 'Gousses et légumineuses', 'Haricots verts, petits pois, edamame', 'à l’ail'),
  ('allium', 'Alliacées', 'Oignon, poireau, fenouil', 'en confit'),
  ('mushroom', 'Champignons', 'Shiitaké, pleurote, champignon de Paris', 'à la poêle')
) as v (code, label_fr, examples_fr, cooking_word_fr)
where t.code = v.code;

alter table public.meal_planner_dish_styles
  add column label_fr text,
  add column name_template_fr text;

update public.meal_planner_dish_styles as t
set label_fr = v.label_fr, name_template_fr = v.name_template_fr
from (values
  ('bowl', 'Bol de riz', 'Bol {protein} {method}, {starch} et {vegetable} {vegetable_method}'),
  ('noodles', 'Bol de nouilles', 'Wok {protein} {method}, {starch} et {vegetable} {vegetable_method}'),
  ('salad', 'Salade composée', 'Salade {protein} {method}, {starch} et {vegetable} {vegetable_method}'),
  ('tacos', 'Tacos', 'Tacos {protein} {method} et {vegetable} {vegetable_method}'),
  ('skillet', 'Poêlée', 'Poêlée {protein} {method}, {starch} et {vegetable} {vegetable_method}'),
  ('roast', 'Plaque au four', 'Plaque {protein} {method}, {starch} {starch_method} et {vegetable} {vegetable_method}')
) as v (code, label_fr, name_template_fr)
where t.code = v.code;

alter table public.meal_planner_starch_kinds
  add column label_fr text,
  add column examples_fr text;

update public.meal_planner_starch_kinds as t
set label_fr = v.label_fr, examples_fr = v.examples_fr
from (values
  ('grain', 'Céréales', 'Riz, épeautre, quinoa, boulgour'),
  ('noodle', 'Nouilles', 'Udon, nouilles de riz, soba'),
  ('bread', 'Pain', 'Pain au levain, ciabatta, naan'),
  ('wraps', 'Galettes', 'Tortillas, pita, pain plat'),
  ('tuber', 'Pommes de terre et racines', 'Pomme de terre, patate douce, polenta'),
  ('wholegrain', 'Céréales complètes', 'Épeautre, quinoa, boulgour, couscous')
) as v (code, label_fr, examples_fr)
where t.code = v.code;

alter table public.meal_planner_units add column label_fr text;

update public.meal_planner_units as t set label_fr = v.label_fr
from (values
  ('piece', 'pièces'),
  ('g', 'grammes'),
  ('kg', 'kilogrammes'),
  ('ml', 'millilitres'),
  ('l', 'litres'),
  ('serving', 'portions'),
  ('bag', 'sachets'),
  ('can', 'boîtes')
) as v (code, label_fr)
where t.code = v.code;

alter table public.meal_planner_cooking_methods
  add column label_fr text,
  add column phrase_fr text;

update public.meal_planner_cooking_methods as t
set label_fr = v.label_fr, phrase_fr = v.phrase_fr
from (values
  ('roast', 'Rôtir', 'au four'),
  ('stir_fry', 'Sauter au wok', 'au wok'),
  ('pan_fry', 'Poêler', 'à la poêle'),
  ('grill', 'Griller', 'au gril'),
  ('smoke', 'Fumer', 'au fumoir'),
  ('steam', 'Vapeur', 'à la vapeur'),
  ('bake', 'Cuire au four', 'en cocotte'),
  ('air_fry', 'Friteuse à air', 'à la friteuse à air'),
  ('deep_fry', 'Frire', 'en friture'),
  ('soup', 'Soupe', 'à feu doux')
) as v (code, label_fr, phrase_fr)
where t.code = v.code;

alter table public.meal_planner_diet_rules add column label_fr text;

update public.meal_planner_diet_rules as t set label_fr = v.label_fr
from (values
  ('vegetarian', 'Végétarien'),
  ('pescatarian', 'Pescétarien'),
  ('no_red_meat', 'Sans viande rouge'),
  ('gluten_free', 'Sans gluten')
) as v (code, label_fr)
where t.code = v.code;

-- The demo pantry a guest starts from, in French: its foods' names and its
-- shopping list's notes. A guest's tab copies them in the language the page is
-- in when it opens.

alter table public.meal_planner_demo_ingredients
  add column name_fr text,
  add column short_name_fr text;

update public.meal_planner_demo_ingredients as t
set name_fr = v.name_fr, short_name_fr = v.short_name_fr
from (values
  ('Chicken Thighs', 'Hauts de cuisse de poulet', 'Poulet'),
  ('Firm Tofu', 'Tofu ferme', 'Tofu'),
  ('Eggs', 'Œufs', 'Œuf'),
  ('Salmon Fillet', 'Filet de saumon', 'Saumon'),
  ('Broccoli', 'Brocoli', null),
  ('Baby Spinach', 'Pousses d’épinards', 'épinards'),
  ('Mushrooms', 'Champignons', null),
  ('Jasmine Rice', 'Riz jasmin', 'Riz'),
  ('Corn Tortillas', 'Tortillas de maïs', 'Tortilla'),
  ('Sweet Potato', 'Patate douce', null)
) as v (name, name_fr, short_name_fr)
where t.name = v.name;

alter table public.meal_planner_demo_shopping_list add column note_fr text;

update public.meal_planner_demo_shopping_list as t set note_fr = v.note_fr
from (values
  ('For the weekend', 'Pour le week-end'),
  ('Drawn twice, never in stock', 'Tiré deux fois, jamais en stock')
) as v (note, note_fr)
where t.note = v.note;

-- migrate:down

alter table public.meal_planner_demo_shopping_list drop column note_fr;

alter table public.meal_planner_demo_ingredients
  drop column short_name_fr,
  drop column name_fr;

alter table public.meal_planner_diet_rules drop column label_fr;

alter table public.meal_planner_cooking_methods
  drop column phrase_fr,
  drop column label_fr;

alter table public.meal_planner_units drop column label_fr;

alter table public.meal_planner_starch_kinds
  drop column examples_fr,
  drop column label_fr;

alter table public.meal_planner_dish_styles
  drop column name_template_fr,
  drop column label_fr;

alter table public.meal_planner_vegetable_kinds
  drop column cooking_word_fr,
  drop column examples_fr,
  drop column label_fr;

alter table public.meal_planner_protein_kinds
  drop column examples_fr,
  drop column label_fr;

alter table public.meal_planner_categories drop column label_fr;
