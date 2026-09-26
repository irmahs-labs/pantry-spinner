# Spin Supper

A mobile web app that decides dinner for you.

Three reels — **Protein**, **Vegetables**, **Starch** — spin from what is actually in your pantry, weighted so items closest to expiring come up more often. Hold any column you like, draw the rest again, then send the dish into the pot. Built for someone who wants to meal-prep but loses track of what they have, so food expires and the same three dishes come round on repeat.

## Screens

| Screen | What it does |
| --- | --- |
| **Draw** | Three reels, a payline, and one button. Click a column to hold it, draw again for the rest, then send the dish into the pot. Space draws too. Beside the dish, _Yesterday you ate …_ says what went into the pot yesterday. |
| **Pantry** | What is stocked, soonest to go off first. Stocking something picks from the ingredients you have already described. |
| **Add ingredient** | Describes a new one: its name, its reel, and its kind. The kind is what dish names and diet filters read. |
| **Shopping list** | What to pick up. Moving something into the pantry is what lets it spin. |
| **Cooking methods** | Which methods are in rotation. Each draw picks one and names the dish after it. |
| **Reel rules** | Diet constraints and the expiry weighting switch. |

A permanent sidebar moves between them.

## How the machine works

**The spin.** Each reel renders its list repeated 10× into one strip and translates it by `-idx * 84px`. The payline is the _middle_ visible cell — strip index `idx + 1`, not `idx`. On a draw, each unlocked reel picks a target by weight, then travels four full turns plus one extra turn per reel for stagger, over `1.50s / 1.92s / 2.34s`. At `2500ms` everything snaps back onto the payline and the result is published. Held reels keep whatever is already on their payline.

**What the reels hold: the pantry, nothing else.** `reelsFrom()` slices what is stocked by the category of each item's ingredient, soonest to go off at the top. An ingredient you have described but not stocked never spins. A reel with nothing in it disables the draw, because a slot machine with an empty column has nothing to pull.

**The weighting.** A pantry item stores the date it goes off, and days remaining are derived from that date every time they are read — so a pantry left alone for a week comes back a week more urgent. With weighting on, an item with two days left is worth `6` against a well-stocked item's `1` — about four times as likely to come up. Turn it off and everything on a reel weighs the same.

**Categories and kinds.** An ingredient belongs to one of three categories, and within it to one _kind_. The three kind tables are separate because they are genuinely different shapes: a protein kind carries the diet it counts as and whether it is red meat; a vegetable kind carries the word its dish name uses; a starch kind carries the shape of the dish and whether it has gluten. That is what makes the diet filters real rather than a list of banned names. Each diet rule is itself a row in `meal_planner_diet_rules` that says what it keeps off in terms of those columns. _No red meat_, for example, is `excludes_red_meat = true`. So a rule works on anything you add, and a new rule is a new row.

**Everything the app says comes from the database.** At startup the app reads the eight reference tables: categories, the three kind tables, dish styles, units, cooking methods and diet rules. It holds no vocabulary of its own. Rewording a method, a kind or a whole dish name is an edit in the Supabase dashboard followed by a reload, with no deploy. If those tables can't be read, the app says so rather than opening with nothing to call anything.

**How an ingredient can be cooked.** When you add an ingredient you tick the methods it can be cooked with. Each draw then picks one of those ticks for each pick, leaving out anything switched off on the Cooking methods screen. An ingredient with nothing ticked gets no method. Holding a column keeps its method as well as its ingredient.

**The dish name.** The starch's kind points at a row in `meal_planner_dish_styles`, and that row's `name_template` is the whole sentence. The app only fills in the placeholders:

```
{method}    {protein} {starch} Bowl with {vegetable_method} {vegetable}
Air-fried   Chicken   Rice     Bowl with roasted            broccoli
└ protein's └ short   └ short             └ vegetable's      └ short name,
  ticked      name      name                ticked method,     lower case
  method                                    else its kind's word
```

`{starch_method}` is available too. The roasting-tray template uses it: _Baked Chicken & roasted Sweet Potato Tray…_. A placeholder with nothing to fill it disappears with its spare space. `phrase` is stored on each method because no rule turns _Air-fry_ into _Air-fried_, and _Soup_ has to become a word that sits before a food: _Simmered_.

## Stack

- **React 19 + TypeScript**, built with **Vite**
- Plain CSS: one stylesheet, `src/styles.css`, with the palette as custom properties on `:root`
- Hand-drawn **Lucide-style glyphs** at stroke-width 2.75, inlined rather than a package
- **Vitest** over the reel engine — the spin maths, weighting, and dish naming
- **Supabase** for storage and magic-link sign-in — where your ingredients, fridge, week and list live

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle into dist/
npm test         # reel-engine unit tests
npm run lint     # typecheck
npm run check    # Ultracite: oxlint + anti-slop, oxfmt — report only
npm run fix      # the same, fixing and formatting what it can
```

### Linting, and the hook

[Ultracite](https://www.ultracite.ai/) runs Oxlint for linting and Oxfmt for formatting, configured in `oxlint.config.ts` and `oxfmt.config.ts`. The lint config extends Ultracite's core and React rules and the **anti-slop** plugin (`eslint-plugin-anti-slop`, run through Oxlint's JS plugin support). Anti-slop flags patterns common in generated code: a type assertion with no `SAFETY:` comment saying why it holds, an unsafe `Record<string, …>` dictionary type, an `unknown` parameter that should have a real type.

Claude Code runs it all as a **PostToolUse hook** (`.claude/settings.json` → `.claude/hooks/ultracite.sh`) after every Write or Edit, on the file that changed:

1. `ultracite fix` on that file only: auto-fixes and formats it.
2. `ultracite check` on the same file for whatever the fixer couldn't handle.
3. `tsc -b --noEmit`, because an auto-fix can break types. The first run turned a typed array into a `Set` and a last-element lookup into `.at(-1)`, which may be `undefined`. Tests passed; only the typecheck noticed.

Anything left over exits with code `2`, which Claude Code hands back to Claude as something to fix before moving on. A clean file exits `0` silently. SQL, YAML and other file types are skipped. Review or disable the hook with `/hooks`.

The first `ultracite fix` over the whole codebase left **280 findings** it can't fix automatically. The 12 `unicorn/filename-case` ones are fixed — files are kebab-case now (`add-ingredient.tsx`, `use-remote-sync.ts`) — which leaves **268**. Most of those are style rules, such as `func-style` wanting arrow functions and `sort-keys`. There are also 83 anti-slop findings, mostly casts with no `SAFETY:` comment. The hook surfaces them file by file, as each file is next edited, rather than all at once.

### Layout

A desktop app: a permanent sidebar and a content column beside it. The Draw screen splits in two — reels on the left, tonight's dish on the right — so a draw never pushes the result below the fold, and it collapses to one column when the window is too narrow to hold both.

### Signing in, or not

Signing in with a magic link puts everything in Supabase under your account. **Have a look around** opens a guest tab instead, starting from a demo pantry that lives in four `meal_planner_demo_*` tables: ten ingredients with their ticked methods, eight of them stocked, and two on the shopping list. The tab copies them once when it opens. From then on the guest works on their own copy in `sessionStorage`, which survives a reload and is gone when the tab closes. Nothing a guest does reaches Supabase, and the demo tables never change.

The demo stores use-by dates as _days from now_, so it is as fresh the day someone opens it as the day it was written. To change the demo, edit those rows; a signed-in account never sees them. If they can't be read, the guest still gets in, just with an empty pantry.

Vocabulary and demo both come from Supabase, so guest mode needs the database connected too. That's why those tables are readable without signing in.

## Storage (Supabase)

Every screen but Draw reads its rows from Supabase, so this is setup, not an extra.

### The data

The eight reference tables and the four demo tables are readable by anyone and writable by no one.

**Grants are explicit.** From 30 October 2025, Supabase no longer grants the Data API access to new tables automatically, so each migration grants the tables it creates. It revokes first, which gives the same result on a project that still has the old defaults. Each role gets only what the app uses:

|  | `anon` | `authenticated` | `service_role` |
| --- | --- | --- | --- |
| Reference and demo tables | select | select | select, insert, update, delete |
| Your data | — | select, insert, update, delete | select, insert, update, delete |

RLS then narrows `authenticated` to your own rows. A new table needs a line in the grants section of the migration that creates it, or the API answers `permission denied`. Every other table carries the `user_id` of the account that owns the row, and its RLS policy compares that to `auth.uid()`. You sign in with an email; Supabase maps the address to a stable user id, so the data follows the account even if the address changes.

| Table | Holds |
| --- | --- |
| `meal_planner_categories` | The three reels — protein, vegetables, starch. Shared, not per user. |
| `meal_planner_protein_kinds` | Red meat, white meat, game, poultry, fish, seafood, eggs & dairy, plant-based — each with the `diet` it counts as and whether it is `is_red_meat`. |
| `meal_planner_vegetable_kinds` | Leafy, brassica, root, fruiting, pods, allium, mushroom — each with the `cooking_word` its dish name uses. |
| `meal_planner_dish_styles` | Bowl, noodles, salad, tacos, skillet, roasting tray — each with a `label` and the `name_template` a dish name is filled from. |
| `meal_planner_starch_kinds` | Grains, noodles, bread, wraps, potatoes, whole grains — each pointing at a dish style, with a gluten default. |
| `meal_planner_units` | Twelve units, from `g` to `serving` to `pot`. `is_count` makes one read as `×8`; `is_default` is the one a new item starts on. |
| `meal_planner_cooking_methods` | Ten methods, each with the `phrase` a dish name uses. |
| `meal_planner_diet_rules` | The Reel rules chips, each described by what it excludes: `excludes_diets`, `excludes_red_meat`, `requires_gluten_free`. |
| `meal_planner_ingredients` | Your ingredient list: `name`, `short_name`, `id_category`, one of three kind columns, and `gluten_free` for starches. |
| `meal_planner_ingredient_methods` | The methods ticked for each ingredient. Its insert policy checks that the ingredient is yours as well as the row. |
| `meal_planner_pantry` | What is stocked: quantity, unit and `date_expiration`. The reels are built from this table alone. |
| `meal_planner_method_settings` | A row only for a method you switched **off**, so a new account has all ten. |
| `meal_planner_shopping_list` | What to buy, why, and whether it has been bought. |
| `meal_planner_history` | Every dish sent into the pot: its name, dish style (by code), method and `date_cooked`. The Draw screen reads yesterday's back. |
| `meal_planner_history_ingredients` | Which of your ingredients each meal was drawn from. Its policy checks that the meal and the ingredient are both yours. |
| `meal_planner_demo_*` | The demo pantry guest mode starts from: ingredients, their methods, pantry (with `days_left` instead of a date) and shopping list. Readable by anyone, owned by no one. Seeded by its own migration. |

Five notes on the shape:

- **Meals are recorded; the Cooked screen is off.** _Into the pot_ writes the dish to `meal_planner_history` and pushes the drawn ingredients' use-by dates two weeks out. The Draw screen shows yesterday's dish from there. `FEATURES.history` in `src/features.ts` now switches only the Cooked screen, which lists every meal and is still `false`.
- **`id_ingredient`, not a repeated name.** Everything keys on an ingredient id and the name lives in `meal_planner_ingredients`. The app works in names; ids are resolved at the boundary in `src/lib/remote.ts`.
- **Three kind tables, not one.** They carry different columns, which is the argument for keeping them apart. An ingredient has three nullable kind columns and a check constraint that exactly the one matching its category is set, so a starch can never carry a protein's kind.
- **A quantity is a number and a unit**: `600` + `g`, `1` + `bag`, `2` + `piece`. A unit marked `is_count` renders as `×2`, anything else as `600 g`.
- **Reel rules are not stored.** Weighting is computed from `date_expiration` at draw time, so there is no rules table; the diet chips and the weighting switch live in memory and reset on reload. Cooking methods _are_ stored, because switching one off is a standing preference rather than a setting for one draw.

1. **Create the project** — [supabase.com/dashboard](https://supabase.com/dashboard) → _New project_. The Free plan allows two active projects per account.
2. **Apply the migrations** — the schema lives in `supabase/migrations/`, one timestamped file per change, and the Supabase CLI applies whatever is not applied yet:

   ```bash
   npx supabase login                          # opens a browser, stores a token
   npx supabase link --project-ref <your-ref>  # the ref from the project URL
   npm run db:push                             # applies pending migrations
   ```

   Or let CI do it. `.github/workflows/database.yml` runs the same CLI on every push to `main` that touches `supabase/migrations/`, and on demand from the Actions tab. It reads three repository settings (_Settings → Secrets and variables → Actions_):

   |                         | Kind     | From                             |
   | ----------------------- | -------- | -------------------------------- |
   | `SUPABASE_ACCESS_TOKEN` | Secret   | Account → Access Tokens          |
   | `SUPABASE_DB_PASSWORD`  | Secret   | Project Settings → Database      |
   | `SUPABASE_PROJECT_REF`  | Variable | The subdomain of the project URL |

   The workflow has two jobs. `verify` starts a throwaway local Postgres with Supabase's own auth schema and replays every migration from nothing, so a broken or out-of-order file fails before it can reach the project — it needs no secrets and runs on pull requests too. `push` runs only after `verify` passes, prints `db push --dry-run` first so the log says what was pending, and then applies.

   Doing it by hand needs three things and none of them is `.env.local`: your Supabase account (the `login` step, which stores a token under `~/.supabase/`, not in the repo), the **project ref** — the subdomain of your project URL — and your **database password**, which `link` and `push` prompt for. The password was set when the project was created; if it is lost, reset it under _Project Settings → Database → Database password_. The `VITE_*` variables are for the browser app at runtime and are never read by the CLI.

   `db push` records each file in the `supabase_migrations` schema, so it never runs one twice. Every migration is also written to be idempotent — `if not exists`, `on conflict do update` — which matters if you first built the database by pasting SQL into the editor: pushing then replays both files over what is already there and changes nothing it does not need to. Pasting a migration straight into _SQL Editor_ still works if you would rather not link.

3. **Turn on magic links** — _Authentication → Sign In / Providers → Email_: enable the provider and leave _Confirm email_ on. Under _Authentication → URL Configuration_ set the **Site URL** to where the app runs (`http://localhost:5173` for development) and add every other origin you use to **Redirect URLs**, including the deployed one. A link only works for a listed origin.
4. **Wire the keys** — copy `.env.example` to `.env.local` and fill in the project URL and the **anon public** key from _Project Settings → API_. This is what the running app reads, and it is separate from the migration step above. Never the service-role key: this is a browser app and the anon key is the only one meant to ship in a bundle.
5. `npm run dev`, enter your email, open the link from the same device.

A new account starts empty — no ingredients, no fridge. Create an ingredient from the Fridge screen's **New** button, or run the seed script, which fills a starting list, fridge, week and shopping list; it is kept outside the repo because it carries a real email address, and it resolves your account by that address, so run it only after a first sign-in has created the account.

### Changing the schema

Write a new migration rather than editing an applied one — `npx supabase migration new <name>` creates the timestamped file, and `npm run db:push` applies it. `npm run db:diff` shows what the linked database has that the migrations do not, which is how a change made by hand in the dashboard gets captured back into the repo. The first file holds the whole original schema; later ones add the demo seed, meal history, and the renamed cooking methods.

Signing in loads your rows into the reducer; from then on the reducer is mirrored back into Postgres — write only what changed. The reducer stays the single source of truth in the session, so a compound action like _Into the pot_ needs no bespoke save path.

Two things become honest once data outlives the session: a pantry item stores a **use-by date** rather than a frozen countdown, so days keep ticking down while the app is closed, and a history entry stores the **date it was cooked**, so tonight's dish stops calling itself "Tonight" tomorrow.

## Deploying (Vercel)

Import the repo and the defaults are right — Vite is detected, `npm run build`, output `dist`. There are no client-side routes, so no rewrite config is needed.

**Environment variables.** `.env.local` is gitignored, so Vercel never sees it: the same two variables have to be set again under _Project Settings → Environment Variables_, ticked for Production, Preview and Development.

Two things about them are easy to get wrong:

- **They are baked in at build time.** Vite substitutes `import.meta.env.*` into the JavaScript during the build rather than reading it when the page loads. Adding or changing a variable does nothing until you **redeploy** — a deploy made before you set them will keep saying it is not connected.
- **Anything named `VITE_*` ships inside the bundle** and is readable by anyone. That is fine for the publishable key, which is designed to be public and is backed by row-level security. It is exactly why a `sb_secret_…` key must never be given a `VITE_` name.

**Supabase URL configuration.** Under _Authentication → URL Configuration_, set the Site URL to the production domain and list every origin that may receive a magic link:

```
Site URL       https://<your-project>.vercel.app

Redirect URLs  https://<your-project>.vercel.app
               https://<your-project>.vercel.app/**
               https://<your-project>-*.vercel.app/**
               http://localhost:5173/**
```

The separators in Supabase's matcher are `.` and `/`: `*` matches within one segment, `**` across several. So `<your-project>-*.vercel.app` covers preview and branch deploys (`…-a1b2c3-you.vercel.app`, `…-git-main-you.vercel.app`) but never the bare production host, which needs its own entry. Both the bare origin and the `/**` form are listed for production because the app sends `emailRedirectTo: window.location.origin`, which carries no path at all.

Take the production domain from Vercel's _Domains_ list rather than assuming it: if the project name was taken, Vercel appends a suffix and the Site URL above would be wrong.

## Project structure

```
.github/workflows/
  database.yml          verify migrations, then apply them to the linked project
supabase/
  config.toml           CLI settings; carries no project identity, no secrets
  migrations/           the schema's history, applied by `supabase db push`
scripts/
  vocab-fixture.sh      regenerates src/test/*.json from the migrations
.claude/
  settings.json         the PostToolUse hook
  hooks/ultracite.sh    fix, check and typecheck the file just edited
oxlint.config.ts        Ultracite core + React + anti-slop
oxfmt.config.ts         Ultracite formatting
src/
  data/model.ts         the app's types — no ingredient data anywhere
  data/vocab.ts         reads the eight reference tables; holds no words of its own
  engine/reel.ts        the machine: reels from the pantry, weighting, spin maths, dish naming
  state/planner.ts      all app state and every action over it
  lib/supabase/         client.ts (browser client), auth.ts (magic link, session, sign out)
  lib/remote.ts         load a snapshot, write only what changed
  lib/guest.ts          the guest tab: one sessionStorage key, lost with the tab
  lib/demo.ts           reads the demo tables into a guest's starting pantry
  lib/use-remote-sync.ts  hydrate on sign-in, mirror the reducer from then on
  components/           icon, switch, sign-in, and glyphs.ts — SVG drawings keyed by code
  test/vocab.json       the reference rows exactly as the migration seeds them
  test/demo.json        the demo rows, likewise
  features.ts           what is built but switched off
  screens/              draw, pantry, add-ingredient, cooked, shopping-list, cooking-methods, reel-rules
  styles.css            one stylesheet; the palette lives in :root
```

There is no `server.ts` or `middleware.ts`: this is a static single-page app with no server runtime, so the anon key plus row-level security is the whole security model.

## Design

The _2a Basket_ skin throughout: forest green on a `#efe9d9` ground, flat fills, no shadows, Gloock over Karla. A permanent sidebar rather than a drawer, because this is a desktop app. The layout came from the `desktop-version` branch; this is that design carried into the real app, with pantry-only reels and Supabase behind it.

Design rules that are load-bearing, not decoration:

- **No sharp corners, no dashed borders.** Containers round to 44/30/24/22/20px; every button, pill, chip and switch is `999px`.
- **Body text sits at ≥4.5:1** against its actual background, headline-scale type at ≥3:1. The secondary inks were darkened once already — do not lighten them back.
- **Every tap target is ≥44px**, including the small `×` and `Stock` actions.
- **Keyboard focus is visible**: `:focus-visible { outline: 2px solid <accent>; outline-offset: 2px }`.

## Not built, deliberately

No onboarding. Cooking a dish refreshes an item's window rather than decrementing its quantity, so the number a row carries is what you put there. An ingredient's category cannot be changed after it is created — remove the ingredient and add it again. There is no screen for adding a cooking method. A method is a row in `meal_planner_cooking_methods` with its `phrase`, so a new one is an insert in the dashboard, and it shows up on Add ingredient after a reload. The diet chips are not persisted.

Three things stay in code on purpose, because they are presentation rather than vocabulary. The first is the SVG icon drawings, keyed by the database's codes, with a plain plate for any dish style the app hasn't drawn. The second is the date presets on the stocking forms. The third is form copy such as "Use by" and "Gluten-free", which labels columns rather than naming anything. The three category codes are fixed as well, because the schema fixes them: an ingredient has one kind column per category, so a fourth category is a migration, not a row. Sync is last-write-wins with no realtime channel, so two devices editing at once will talk over each other. These are the obvious next increments, not oversights.
