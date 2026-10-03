\restrict dbmate

-- Dumped from database version 17.11
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: meal_planner_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_categories (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "position" smallint NOT NULL
);


--
-- Name: meal_planner_cooking_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_cooking_methods (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    phrase text NOT NULL
);


--
-- Name: meal_planner_demo_ingredient_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_demo_ingredient_methods (
    id_demo_ingredient smallint NOT NULL,
    id_method smallint NOT NULL
);


--
-- Name: meal_planner_demo_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_demo_ingredients (
    id smallint NOT NULL,
    name text NOT NULL,
    short_name text,
    id_category smallint NOT NULL,
    id_protein_kind smallint,
    id_vegetable_kind smallint,
    id_starch_kind smallint,
    gluten_free boolean,
    CONSTRAINT demo_kind_matches_category CHECK (
CASE id_category
    WHEN 1 THEN ((id_protein_kind IS NOT NULL) AND (id_vegetable_kind IS NULL) AND (id_starch_kind IS NULL))
    WHEN 2 THEN ((id_vegetable_kind IS NOT NULL) AND (id_protein_kind IS NULL) AND (id_starch_kind IS NULL))
    WHEN 3 THEN ((id_starch_kind IS NOT NULL) AND (id_protein_kind IS NULL) AND (id_vegetable_kind IS NULL))
    ELSE false
END)
);


--
-- Name: meal_planner_demo_pantry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_demo_pantry (
    id_demo_ingredient smallint NOT NULL,
    quantity numeric NOT NULL,
    id_unit smallint NOT NULL,
    days_left smallint NOT NULL,
    serving_size numeric DEFAULT 1 NOT NULL,
    CONSTRAINT meal_planner_demo_pantry_days_left_check CHECK ((days_left >= 0)),
    CONSTRAINT meal_planner_demo_pantry_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT meal_planner_demo_pantry_serving_size_check CHECK ((serving_size > (0)::numeric))
);


--
-- Name: meal_planner_demo_shopping_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_demo_shopping_list (
    id_demo_ingredient smallint NOT NULL,
    quantity numeric NOT NULL,
    id_unit smallint NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    CONSTRAINT meal_planner_demo_shopping_list_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: meal_planner_diet_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_diet_rules (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    excludes_diets text[] DEFAULT '{}'::text[] NOT NULL,
    excludes_red_meat boolean DEFAULT false NOT NULL,
    requires_gluten_free boolean DEFAULT false NOT NULL
);


--
-- Name: meal_planner_dish_styles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_dish_styles (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    name_template text NOT NULL
);


--
-- Name: meal_planner_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_history (
    id uuid NOT NULL,
    user_id text NOT NULL,
    name_meal text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    dish_style text,
    id_method smallint,
    date_cooked date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: meal_planner_history_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_history_ingredients (
    user_id text NOT NULL,
    id_history uuid NOT NULL,
    id_ingredient uuid NOT NULL
);


--
-- Name: meal_planner_ingredient_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_ingredient_methods (
    user_id text NOT NULL,
    id_ingredient uuid NOT NULL,
    id_method smallint NOT NULL
);


--
-- Name: meal_planner_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    short_name text,
    id_category smallint NOT NULL,
    id_protein_kind smallint,
    id_vegetable_kind smallint,
    id_starch_kind smallint,
    gluten_free boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kind_matches_category CHECK (
CASE id_category
    WHEN 1 THEN ((id_protein_kind IS NOT NULL) AND (id_vegetable_kind IS NULL) AND (id_starch_kind IS NULL))
    WHEN 2 THEN ((id_vegetable_kind IS NOT NULL) AND (id_protein_kind IS NULL) AND (id_starch_kind IS NULL))
    WHEN 3 THEN ((id_starch_kind IS NOT NULL) AND (id_protein_kind IS NULL) AND (id_vegetable_kind IS NULL))
    ELSE false
END)
);


--
-- Name: meal_planner_method_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_method_settings (
    user_id text NOT NULL,
    id_method smallint NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);


--
-- Name: meal_planner_pantry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_pantry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    id_ingredient uuid NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    id_unit smallint DEFAULT 1 NOT NULL,
    date_expiration date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    serving_size numeric DEFAULT 1 NOT NULL,
    CONSTRAINT meal_planner_pantry_quantity_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT meal_planner_pantry_serving_size_check CHECK ((serving_size > (0)::numeric))
);


--
-- Name: COLUMN meal_planner_pantry.serving_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meal_planner_pantry.serving_size IS 'How much one serving is, in the serving unit of id_unit (grams for kilograms, millilitres for litres), or 1 for a unit that is its own serving.';


--
-- Name: meal_planner_protein_kinds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_protein_kinds (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    examples text DEFAULT ''::text NOT NULL,
    diet text NOT NULL,
    is_red_meat boolean DEFAULT false NOT NULL,
    CONSTRAINT meal_planner_protein_kinds_diet_check CHECK ((diet = ANY (ARRAY['meat'::text, 'fish'::text, 'veg'::text])))
);


--
-- Name: meal_planner_shopping_list; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_shopping_list (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    id_ingredient uuid NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    id_unit smallint DEFAULT 1 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    acquired boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT meal_planner_shopping_list_quantity_check CHECK ((quantity >= (0)::numeric))
);


--
-- Name: meal_planner_starch_kinds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_starch_kinds (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    examples text DEFAULT ''::text NOT NULL,
    id_dish_style smallint NOT NULL,
    gluten_free boolean DEFAULT false NOT NULL
);


--
-- Name: meal_planner_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_units (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    is_count boolean DEFAULT false NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    default_serving numeric,
    id_serving_unit smallint,
    serving_factor numeric DEFAULT 1 NOT NULL,
    CONSTRAINT meal_planner_units_default_serving_check CHECK ((default_serving > (0)::numeric)),
    CONSTRAINT meal_planner_units_serving_factor_check CHECK ((serving_factor > (0)::numeric))
);


--
-- Name: COLUMN meal_planner_units.default_serving; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meal_planner_units.default_serving IS 'What a serving starts at when something is stocked in this unit, in its serving unit. Null: the unit is its own serving (one piece, one can).';


--
-- Name: COLUMN meal_planner_units.id_serving_unit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meal_planner_units.id_serving_unit IS 'The unit a serving is sized in when stocking in this one: grams for kilograms, millilitres for litres. Null for units that are their own serving.';


--
-- Name: COLUMN meal_planner_units.serving_factor; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meal_planner_units.serving_factor IS 'How many serving units make one of this unit: 1000 for kilograms, 1 for grams.';


--
-- Name: meal_planner_vegetable_kinds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_planner_vegetable_kinds (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    examples text DEFAULT ''::text NOT NULL,
    cooking_word text NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: meal_planner_categories meal_planner_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_categories
    ADD CONSTRAINT meal_planner_categories_code_key UNIQUE (code);


--
-- Name: meal_planner_categories meal_planner_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_categories
    ADD CONSTRAINT meal_planner_categories_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_categories meal_planner_categories_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_categories
    ADD CONSTRAINT meal_planner_categories_position_key UNIQUE ("position");


--
-- Name: meal_planner_cooking_methods meal_planner_cooking_methods_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_cooking_methods
    ADD CONSTRAINT meal_planner_cooking_methods_code_key UNIQUE (code);


--
-- Name: meal_planner_cooking_methods meal_planner_cooking_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_cooking_methods
    ADD CONSTRAINT meal_planner_cooking_methods_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_demo_ingredient_methods meal_planner_demo_ingredient_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredient_methods
    ADD CONSTRAINT meal_planner_demo_ingredient_methods_pkey PRIMARY KEY (id_demo_ingredient, id_method);


--
-- Name: meal_planner_demo_ingredients meal_planner_demo_ingredients_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredients
    ADD CONSTRAINT meal_planner_demo_ingredients_name_key UNIQUE (name);


--
-- Name: meal_planner_demo_ingredients meal_planner_demo_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredients
    ADD CONSTRAINT meal_planner_demo_ingredients_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_demo_pantry meal_planner_demo_pantry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_pantry
    ADD CONSTRAINT meal_planner_demo_pantry_pkey PRIMARY KEY (id_demo_ingredient);


--
-- Name: meal_planner_demo_shopping_list meal_planner_demo_shopping_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_shopping_list
    ADD CONSTRAINT meal_planner_demo_shopping_list_pkey PRIMARY KEY (id_demo_ingredient);


--
-- Name: meal_planner_diet_rules meal_planner_diet_rules_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_diet_rules
    ADD CONSTRAINT meal_planner_diet_rules_code_key UNIQUE (code);


--
-- Name: meal_planner_diet_rules meal_planner_diet_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_diet_rules
    ADD CONSTRAINT meal_planner_diet_rules_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_dish_styles meal_planner_dish_styles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_dish_styles
    ADD CONSTRAINT meal_planner_dish_styles_code_key UNIQUE (code);


--
-- Name: meal_planner_dish_styles meal_planner_dish_styles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_dish_styles
    ADD CONSTRAINT meal_planner_dish_styles_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_history meal_planner_history_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_history
    ADD CONSTRAINT meal_planner_history_id_user_id_key UNIQUE (id, user_id);


--
-- Name: meal_planner_history_ingredients meal_planner_history_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_history_ingredients
    ADD CONSTRAINT meal_planner_history_ingredients_pkey PRIMARY KEY (id_history, id_ingredient);


--
-- Name: meal_planner_history meal_planner_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_history
    ADD CONSTRAINT meal_planner_history_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_ingredient_methods meal_planner_ingredient_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredient_methods
    ADD CONSTRAINT meal_planner_ingredient_methods_pkey PRIMARY KEY (id_ingredient, id_method);


--
-- Name: meal_planner_ingredients meal_planner_ingredients_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredients
    ADD CONSTRAINT meal_planner_ingredients_id_user_id_key UNIQUE (id, user_id);


--
-- Name: meal_planner_ingredients meal_planner_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredients
    ADD CONSTRAINT meal_planner_ingredients_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_ingredients meal_planner_ingredients_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredients
    ADD CONSTRAINT meal_planner_ingredients_user_id_name_key UNIQUE (user_id, name);


--
-- Name: meal_planner_method_settings meal_planner_method_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_method_settings
    ADD CONSTRAINT meal_planner_method_settings_pkey PRIMARY KEY (user_id, id_method);


--
-- Name: meal_planner_pantry meal_planner_pantry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_pantry
    ADD CONSTRAINT meal_planner_pantry_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_pantry meal_planner_pantry_user_id_id_ingredient_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_pantry
    ADD CONSTRAINT meal_planner_pantry_user_id_id_ingredient_key UNIQUE (user_id, id_ingredient);


--
-- Name: meal_planner_protein_kinds meal_planner_protein_kinds_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_protein_kinds
    ADD CONSTRAINT meal_planner_protein_kinds_code_key UNIQUE (code);


--
-- Name: meal_planner_protein_kinds meal_planner_protein_kinds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_protein_kinds
    ADD CONSTRAINT meal_planner_protein_kinds_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_shopping_list meal_planner_shopping_list_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_shopping_list
    ADD CONSTRAINT meal_planner_shopping_list_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_shopping_list meal_planner_shopping_list_user_id_id_ingredient_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_shopping_list
    ADD CONSTRAINT meal_planner_shopping_list_user_id_id_ingredient_key UNIQUE (user_id, id_ingredient);


--
-- Name: meal_planner_starch_kinds meal_planner_starch_kinds_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_starch_kinds
    ADD CONSTRAINT meal_planner_starch_kinds_code_key UNIQUE (code);


--
-- Name: meal_planner_starch_kinds meal_planner_starch_kinds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_starch_kinds
    ADD CONSTRAINT meal_planner_starch_kinds_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_units meal_planner_units_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_units
    ADD CONSTRAINT meal_planner_units_code_key UNIQUE (code);


--
-- Name: meal_planner_units meal_planner_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_units
    ADD CONSTRAINT meal_planner_units_pkey PRIMARY KEY (id);


--
-- Name: meal_planner_vegetable_kinds meal_planner_vegetable_kinds_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_vegetable_kinds
    ADD CONSTRAINT meal_planner_vegetable_kinds_code_key UNIQUE (code);


--
-- Name: meal_planner_vegetable_kinds meal_planner_vegetable_kinds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_vegetable_kinds
    ADD CONSTRAINT meal_planner_vegetable_kinds_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: meal_planner_history_ingredients_ingredient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_planner_history_ingredients_ingredient_idx ON public.meal_planner_history_ingredients USING btree (id_ingredient);


--
-- Name: meal_planner_history_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_planner_history_user_date_idx ON public.meal_planner_history USING btree (user_id, date_cooked DESC, created_at DESC);


--
-- Name: meal_planner_ingredient_methods_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_planner_ingredient_methods_user_idx ON public.meal_planner_ingredient_methods USING btree (user_id);


--
-- Name: meal_planner_ingredients_user_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_planner_ingredients_user_category_idx ON public.meal_planner_ingredients USING btree (user_id, id_category);


--
-- Name: meal_planner_pantry_user_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_planner_pantry_user_expiry_idx ON public.meal_planner_pantry USING btree (user_id, date_expiration);


--
-- Name: meal_planner_shopping_list_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_planner_shopping_list_user_created_idx ON public.meal_planner_shopping_list USING btree (user_id, created_at DESC);


--
-- Name: meal_planner_demo_ingredient_methods meal_planner_demo_ingredient_methods_id_demo_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredient_methods
    ADD CONSTRAINT meal_planner_demo_ingredient_methods_id_demo_ingredient_fkey FOREIGN KEY (id_demo_ingredient) REFERENCES public.meal_planner_demo_ingredients(id) ON DELETE CASCADE;


--
-- Name: meal_planner_demo_ingredient_methods meal_planner_demo_ingredient_methods_id_method_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredient_methods
    ADD CONSTRAINT meal_planner_demo_ingredient_methods_id_method_fkey FOREIGN KEY (id_method) REFERENCES public.meal_planner_cooking_methods(id);


--
-- Name: meal_planner_demo_ingredients meal_planner_demo_ingredients_id_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredients
    ADD CONSTRAINT meal_planner_demo_ingredients_id_category_fkey FOREIGN KEY (id_category) REFERENCES public.meal_planner_categories(id);


--
-- Name: meal_planner_demo_ingredients meal_planner_demo_ingredients_id_protein_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredients
    ADD CONSTRAINT meal_planner_demo_ingredients_id_protein_kind_fkey FOREIGN KEY (id_protein_kind) REFERENCES public.meal_planner_protein_kinds(id);


--
-- Name: meal_planner_demo_ingredients meal_planner_demo_ingredients_id_starch_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredients
    ADD CONSTRAINT meal_planner_demo_ingredients_id_starch_kind_fkey FOREIGN KEY (id_starch_kind) REFERENCES public.meal_planner_starch_kinds(id);


--
-- Name: meal_planner_demo_ingredients meal_planner_demo_ingredients_id_vegetable_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_ingredients
    ADD CONSTRAINT meal_planner_demo_ingredients_id_vegetable_kind_fkey FOREIGN KEY (id_vegetable_kind) REFERENCES public.meal_planner_vegetable_kinds(id);


--
-- Name: meal_planner_demo_pantry meal_planner_demo_pantry_id_demo_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_pantry
    ADD CONSTRAINT meal_planner_demo_pantry_id_demo_ingredient_fkey FOREIGN KEY (id_demo_ingredient) REFERENCES public.meal_planner_demo_ingredients(id) ON DELETE CASCADE;


--
-- Name: meal_planner_demo_pantry meal_planner_demo_pantry_id_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_pantry
    ADD CONSTRAINT meal_planner_demo_pantry_id_unit_fkey FOREIGN KEY (id_unit) REFERENCES public.meal_planner_units(id);


--
-- Name: meal_planner_demo_shopping_list meal_planner_demo_shopping_list_id_demo_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_shopping_list
    ADD CONSTRAINT meal_planner_demo_shopping_list_id_demo_ingredient_fkey FOREIGN KEY (id_demo_ingredient) REFERENCES public.meal_planner_demo_ingredients(id) ON DELETE CASCADE;


--
-- Name: meal_planner_demo_shopping_list meal_planner_demo_shopping_list_id_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_demo_shopping_list
    ADD CONSTRAINT meal_planner_demo_shopping_list_id_unit_fkey FOREIGN KEY (id_unit) REFERENCES public.meal_planner_units(id);


--
-- Name: meal_planner_history meal_planner_history_dish_style_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_history
    ADD CONSTRAINT meal_planner_history_dish_style_fkey FOREIGN KEY (dish_style) REFERENCES public.meal_planner_dish_styles(code) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: meal_planner_history meal_planner_history_id_method_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_history
    ADD CONSTRAINT meal_planner_history_id_method_fkey FOREIGN KEY (id_method) REFERENCES public.meal_planner_cooking_methods(id) ON DELETE SET NULL;


--
-- Name: meal_planner_history_ingredients meal_planner_history_ingredients_id_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_history_ingredients
    ADD CONSTRAINT meal_planner_history_ingredients_id_history_user_id_fkey FOREIGN KEY (id_history, user_id) REFERENCES public.meal_planner_history(id, user_id) ON DELETE CASCADE;


--
-- Name: meal_planner_history_ingredients meal_planner_history_ingredients_id_ingredient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_history_ingredients
    ADD CONSTRAINT meal_planner_history_ingredients_id_ingredient_user_id_fkey FOREIGN KEY (id_ingredient, user_id) REFERENCES public.meal_planner_ingredients(id, user_id) ON DELETE CASCADE;


--
-- Name: meal_planner_ingredient_methods meal_planner_ingredient_methods_id_ingredient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredient_methods
    ADD CONSTRAINT meal_planner_ingredient_methods_id_ingredient_user_id_fkey FOREIGN KEY (id_ingredient, user_id) REFERENCES public.meal_planner_ingredients(id, user_id) ON DELETE CASCADE;


--
-- Name: meal_planner_ingredient_methods meal_planner_ingredient_methods_id_method_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredient_methods
    ADD CONSTRAINT meal_planner_ingredient_methods_id_method_fkey FOREIGN KEY (id_method) REFERENCES public.meal_planner_cooking_methods(id);


--
-- Name: meal_planner_ingredients meal_planner_ingredients_id_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredients
    ADD CONSTRAINT meal_planner_ingredients_id_category_fkey FOREIGN KEY (id_category) REFERENCES public.meal_planner_categories(id);


--
-- Name: meal_planner_ingredients meal_planner_ingredients_id_protein_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredients
    ADD CONSTRAINT meal_planner_ingredients_id_protein_kind_fkey FOREIGN KEY (id_protein_kind) REFERENCES public.meal_planner_protein_kinds(id);


--
-- Name: meal_planner_ingredients meal_planner_ingredients_id_starch_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredients
    ADD CONSTRAINT meal_planner_ingredients_id_starch_kind_fkey FOREIGN KEY (id_starch_kind) REFERENCES public.meal_planner_starch_kinds(id);


--
-- Name: meal_planner_ingredients meal_planner_ingredients_id_vegetable_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_ingredients
    ADD CONSTRAINT meal_planner_ingredients_id_vegetable_kind_fkey FOREIGN KEY (id_vegetable_kind) REFERENCES public.meal_planner_vegetable_kinds(id);


--
-- Name: meal_planner_method_settings meal_planner_method_settings_id_method_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_method_settings
    ADD CONSTRAINT meal_planner_method_settings_id_method_fkey FOREIGN KEY (id_method) REFERENCES public.meal_planner_cooking_methods(id);


--
-- Name: meal_planner_pantry meal_planner_pantry_id_ingredient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_pantry
    ADD CONSTRAINT meal_planner_pantry_id_ingredient_user_id_fkey FOREIGN KEY (id_ingredient, user_id) REFERENCES public.meal_planner_ingredients(id, user_id) ON DELETE CASCADE;


--
-- Name: meal_planner_pantry meal_planner_pantry_id_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_pantry
    ADD CONSTRAINT meal_planner_pantry_id_unit_fkey FOREIGN KEY (id_unit) REFERENCES public.meal_planner_units(id);


--
-- Name: meal_planner_shopping_list meal_planner_shopping_list_id_ingredient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_shopping_list
    ADD CONSTRAINT meal_planner_shopping_list_id_ingredient_user_id_fkey FOREIGN KEY (id_ingredient, user_id) REFERENCES public.meal_planner_ingredients(id, user_id) ON DELETE CASCADE;


--
-- Name: meal_planner_shopping_list meal_planner_shopping_list_id_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_shopping_list
    ADD CONSTRAINT meal_planner_shopping_list_id_unit_fkey FOREIGN KEY (id_unit) REFERENCES public.meal_planner_units(id);


--
-- Name: meal_planner_starch_kinds meal_planner_starch_kinds_id_dish_style_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_starch_kinds
    ADD CONSTRAINT meal_planner_starch_kinds_id_dish_style_fkey FOREIGN KEY (id_dish_style) REFERENCES public.meal_planner_dish_styles(id);


--
-- Name: meal_planner_units meal_planner_units_id_serving_unit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_planner_units
    ADD CONSTRAINT meal_planner_units_id_serving_unit_fkey FOREIGN KEY (id_serving_unit) REFERENCES public.meal_planner_units(id);


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20261003190000'),
    ('20261003190001');
