# Slot machine meal planner

A mobile web app that decides dinner for you.

Three reels — **Protein**, **Vegetables**, **Starch** — spin from what is actually in your pantry, weighted so items closest to expiring come up more often. Hold any column you like, draw the rest again, then send the dish into the pot. Built for someone who wants to meal-prep but loses track of what they have, so food expires and the same three dishes come round on repeat.

## Screens

| Screen | What it does |
| --- | --- |
| **Draw** | Three reels, a payline, and one button. Click a column to hold it, draw again for the rest, then send the dish into the pot. Space draws too. Beside the dish, _Yesterday you ate …_ says what went into the pot yesterday. |
| **Pantry** | What is stocked, soonest to go off first. Stocking something picks from the ingredients you have already described. _Edit_ on a card changes how that ingredient can be cooked. |
| **Add ingredient** | Describes a new one: its name, its reel, and its kind. The kind is what dish names and diet filters read. |
| **Shopping list** | What to pick up, and how much. Moving something into the pantry is what lets it spin. |
| **Cooking methods** | Which methods are in rotation. Each draw picks one and names the dish after it. |
| **Reel rules** | Diet constraints and the expiry weighting switch. |

A permanent sidebar moves between them.

## How the machine works

**The spin.** Each reel renders its list repeated 10× into one strip and translates it by `-idx * 84px`. The payline is the _middle_ visible cell — strip index `idx + 1`, not `idx`. On a draw, each unlocked reel picks a target by weight, then travels four full turns plus one extra turn per reel for stagger, over `1.50s / 1.92s / 2.34s`. At `2500ms` everything snaps back onto the payline and the result is published. Held reels keep whatever is already on their payline.

**What the reels hold: the pantry, nothing else.** `reelsFrom()` slices what is stocked by the category of each item's ingredient, soonest to go off at the top. An ingredient you have described but not stocked never spins. A reel with nothing in it disables the draw, because a slot machine with an empty column has nothing to pull.

**The weighting.** A pantry item stores the date it goes off, and days remaining are derived from that date every time they are read — so a pantry left alone for a week comes back a week more urgent. With weighting on, an item with two days left is worth `6` against a well-stocked item's `1` — about four times as likely to come up. Turn it off and everything on a reel weighs the same.

**Categories and kinds.** An ingredient belongs to one of three categories, and within it to one _kind_. The three kind tables are separate because they are genuinely different shapes: a protein kind carries the diet it counts as and whether it is red meat; a vegetable kind carries the word its dish name uses; a starch kind carries the shape of the dish and whether it has gluten. That is what makes the diet filters real rather than a list of banned names. Each diet rule is itself a row in `meal_planner_diet_rules` that says what it keeps off in terms of those columns. _No red meat_, for example, is `excludes_red_meat = true`. So a rule works on anything you add, and a new rule is a new row.

**Everything the app says comes from the database.** At startup the app reads the eight reference tables: categories, the three kind tables, dish styles, units, cooking methods and diet rules. It holds no vocabulary of its own. Rewording a method, a kind or a whole dish name is a migration that updates its row; the app's code doesn't change. If those tables can't be read, the app says so rather than opening with nothing to call anything.

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
- **Postgres 17** for storage, with migrations applied by **dbmate**, both run in Docker — where your ingredients, fridge, week and list live
- **Hono** on Node for the API in `server/`, the only thing that reaches the database
- Sign-in through **IrmaHS Labs** ([irmahs-labs/auth](https://github.com/irmahs-labs/auth)), the Google account shared by every irmahs.dev app

## Getting started

Needs Node 22+ and Docker.

```bash
npm install
cp .env.example .env   # local settings for the API and the app
npm run db:up          # Postgres on :5432, migrations applied
npm run dev:api        # the API on :3002
npm run dev            # the app on http://localhost:5173, which forwards /api to :3002
```

Signing in locally also needs the account service running on `:3001` (see [irmahs-labs/auth](https://github.com/irmahs-labs/auth)); without it, **Have a look around** still works.

```bash
npm run build          # the app into dist/, the server bundled into dist-server/main.js
npm test               # reel-engine unit tests
npm run lint           # typecheck the app and the server
npm run check          # Ultracite: oxlint + anti-slop, oxfmt — report only
npm run fix            # the same, fixing and formatting what it can
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

**Continue with Google** goes to the IrmaHS Labs sign-in page at `auth.irmahs.dev` and comes back signed in. The session cookie is shared by every `*.irmahs.dev` app, so someone already signed in on another of them is signed in here too. Signing out signs out of all of them. The app asks its own API who is signed in (`/api/me`), and the API asks the account service; the app never sees Google.

**Have a look around** opens a guest tab instead, starting from a demo pantry that lives in four `meal_planner_demo_*` tables: ten ingredients with their ticked methods, eight of them stocked, and two on the shopping list. The tab copies them once when it opens. From then on the guest works on their own copy in `sessionStorage`, which survives a reload and is gone when the tab closes. Nothing a guest does is saved anywhere else, and the demo tables never change.

The demo stores use-by dates as _days from now_, so it is as fresh the day someone opens it as the day it was written. To change the demo, write a migration that edits those rows; a signed-in account never sees them. If they can't be read, the guest still gets in, just with an empty pantry.

Vocabulary and demo both come from the API, so guest mode needs it and the database running too. That's why those endpoints answer without signing in.

## Storage (Postgres)

Every screen but Draw reads its rows from the database, so this is setup, not an extra.

### Running it locally

Docker is the only requirement; `compose.yaml` runs Postgres 17 and dbmate.

```bash
npm run db:up               # start Postgres on localhost:5432 and apply pending migrations
npm run db:new -- <name>    # create db/migrations/<timestamp>_<name>.sql
npm run db:reset            # delete the local database and build it again from the migrations
npm run db:fixtures         # regenerate src/test/*.json from the migrations
```

The local database is `postgres://sleepy:sleepy@localhost:5432/sleepy_spinner`. Those credentials belong to the local container only.

### The data

The eight reference tables and the four demo tables are shared by everyone and owned by no one. Every other table carries the `user_id` of the account that owns the row: the account's UUID from the irmahs.dev account service ([irmahs-labs/auth](https://github.com/irmahs-labs/auth)), whose accounts live in that service's own database.

The browser never reaches the database; the API does, and scopes every query to the signed-in account. The database backs that up on its own: wherever one of your rows points at another, the foreign key includes `user_id`, so a pantry entry, a ticked method, a shopping-list line or a cooked meal can only point at **your** ingredient. Postgres refuses the row otherwise, whatever the API asks for.

| Table | Holds |
| --- | --- |
| `meal_planner_categories` | The three reels — protein, vegetables, starch. Shared, not per user. |
| `meal_planner_protein_kinds` | Red meat, white meat, game, poultry, fish, seafood, eggs & dairy, plant-based — each with the `diet` it counts as and whether it is `is_red_meat`. |
| `meal_planner_vegetable_kinds` | Leafy, brassica, root, fruiting, pods, allium, mushroom — each with the `cooking_word` its dish name uses. |
| `meal_planner_dish_styles` | Bowl, noodles, salad, tacos, skillet, roasting tray — each with a `label` and the `name_template` a dish name is filled from. |
| `meal_planner_starch_kinds` | Grains, noodles, bread, wraps, potatoes, whole grains — each pointing at a dish style, with a gluten default. |
| `meal_planner_units` | Eight units: `piece`, `g`, `kg`, `ml`, `l`, `serving`, `bag`, `can`. `is_count` makes one read as `×8`; `is_default` is the one a new item starts on; `default_serving` is set only for weights and volumes, and is what a serving starts at there, in the unit's `id_serving_unit` — grams for `g` and `kg`, millilitres for `ml` and `l` — with `serving_factor` saying how many of those make one (1000 for `kg`). |
| `meal_planner_cooking_methods` | Ten methods, each with the `phrase` a dish name uses. |
| `meal_planner_diet_rules` | The Reel rules chips, each described by what it excludes: `excludes_diets`, `excludes_red_meat`, `requires_gluten_free`. |
| `meal_planner_ingredients` | Your ingredient list: `name`, `short_name`, `id_category`, one of three kind columns, and `gluten_free` for starches. |
| `meal_planner_ingredient_methods` | The methods ticked for each ingredient — always one of yours. |
| `meal_planner_pantry` | What is stocked: quantity, unit, `serving_size` (in the unit's serving unit, so a kilogram of rice has a serving of `75`, meaning grams) and `date_expiration`. The reels are built from this table alone. |
| `meal_planner_method_settings` | A row only for a method you switched **off**, so a new account has all ten. |
| `meal_planner_shopping_list` | What to buy, why, and whether it has been bought. |
| `meal_planner_history` | Every dish sent into the pot: its name, dish style (by code), method and `date_cooked`. The Draw screen reads yesterday's back. |
| `meal_planner_history_ingredients` | Which of your ingredients each meal was drawn from. Both the meal and the ingredient have to be yours. |
| `meal_planner_demo_*` | The demo pantry guest mode starts from: ingredients, their methods, pantry (with `days_left` instead of a date) and shopping list. Owned by no one. Seeded by its own migration. |

Five notes on the shape:

- **Meals are recorded; the Cooked screen is off.** _Into the pot_ writes the dish to `meal_planner_history` and uses one serving of each drawn ingredient; cooking the last serving (or what is left of one) takes it out of the pantry. The Draw screen shows yesterday's dish from there. `FEATURES.history` in `src/features.ts` now switches only the Cooked screen, which lists every meal and is still `false`.
- **`id_ingredient`, not a repeated name.** Everything keys on an ingredient id and the name lives in `meal_planner_ingredients`. The app works in names; ids are resolved at the boundary in `src/lib/remote.ts`.
- **Three kind tables, not one.** They carry different columns, which is the argument for keeping them apart. An ingredient has three nullable kind columns and a check constraint that exactly the one matching its category is set, so a starch can never carry a protein's kind.
- **A quantity is a number and a unit**: `600` + `g`, `1` + `bag`, `2` + `piece`. A unit marked `is_count` renders as `×2`, anything else as `600 g`.
- **Reel rules are not stored.** Weighting is computed from `date_expiration` at draw time, so there is no rules table; the diet chips and the weighting switch live in memory and reset on reload. Cooking methods _are_ stored, because switching one off is a standing preference rather than a setting for one draw.

A new account starts empty — no ingredients, no fridge. Create an ingredient from the Fridge screen's **New** button.

### Changing the schema

Write a new migration rather than editing an applied one: `npm run db:new -- <name>` creates the file, with a `-- migrate:up` section and a `-- migrate:down` section that undoes it. `npm run db:up` applies it and rewrites `db/schema.sql`, the full schema as it stands, which is committed so a pull request shows the effect of a migration as well as its text.

`.github/workflows/database.yml` checks every change to `db/`: the migrations apply to an empty database, every `migrate:down` rolls back cleanly, and `db/schema.sql` and the test fixtures still match what the migrations build. If the reference or demo rows change, run `npm run db:fixtures` and commit the result.

The first two files fold the seven Supabase migrations into one schema and one demo seed, written out as they ended up rather than replayed step by step; the new database starts empty, so there was no history to keep. They were checked against a replay of the old files: every reference and demo row is identical.

Signing in loads your rows into the reducer; from then on the reducer is mirrored back into Postgres — write only what changed. The reducer stays the single source of truth in the session, so a compound action like _Into the pot_ needs no bespoke save path.

Two things become honest once data outlives the session: a pantry item stores a **use-by date** rather than a frozen countdown, so days keep ticking down while the app is closed, and a history entry stores the **date it was cooked**, so tonight's dish stops calling itself "Tonight" tomorrow.

## The API

`server/` is a small [Hono](https://hono.dev/) server, the only thing that reaches Postgres:

| Endpoint | Who | What |
| --- | --- | --- |
| `GET /api/vocab` | anyone | The eight reference tables, in the shape of `src/test/vocab.json` |
| `GET /api/demo` | anyone | The four demo tables, in the shape of `src/test/demo.json` |
| `GET /api/me` | anyone | The signed-in account, or `null` |
| `GET /api/snapshot` | signed in | Your ingredients, pantry, plan, list and switched-off methods |
| `PUT /api/snapshot` | signed in | Saves your snapshot as it now stands |

**The account id comes only from the session.** The API forwards the browser's cookie to the account service and takes the id from its answer; nothing in a request body or URL is ever used as one. The database backs this up: foreign keys between your rows include `user_id`, so a row can only point at your own ingredient.

**A save is all or nothing.** The body is validated first (`server/validate.ts`: strict, so unknown fields like a `user_id` are refused), then compared with what is stored, and only the differences are written, in one transaction. A unit, method or kind the reference tables don't have is a `400`, and nothing from that save is kept. The app sends one save at a time, always of the newest state, so two quick changes cannot land out of order.

**Writes come only from the app's own pages.** The shared cookie would otherwise vouch for a request from any `*.irmahs.dev` site, so `PUT` is refused unless its `Origin` is the app's.

## Deploying

The app runs on the irmahs.dev server at **https://sleepy-spinner.irmahs.dev**, behind the shared Caddy proxy ([irmahs-labs/proxy](https://github.com/irmahs-labs/proxy)).

One image holds both halves: the built app and the bundled server, which serves the app beside `/api` from the same origin. `compose.prod.yaml` adds the app's own Postgres on an internal network. The app joins the shared `proxy` network as `sleepy-spinner:3000`, where it also reaches the account service as `auth:3001`.

Pushing to `main` deploys to `/srv/sleepy-spinner`: Postgres starts, pending migrations run, then the app is rebuilt and started. Secrets (Settings → Secrets and variables → Actions):

| Secret | What |
| --- | --- |
| `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST` | Organization level, shared with the other repos |
| `SLEEPY_POSTGRES_PASSWORD` | The database's password. Read only when the database is first created |

The settings that are not secret (`APP_URL`, `AUTH_INTERNAL_URL`) are in `compose.prod.yaml`. CI type-checks, tests, builds, and builds the image on every pull request; the Database workflow checks the migrations.

## Project structure

```
.github/workflows/
  database.yml          migrations build, roll back, and match schema.sql and the fixtures
db/
  migrations/           one timestamped file per change, applied by dbmate
  schema.sql            the whole schema as it stands, written by `npm run db:up`
compose.yaml            local Postgres and dbmate
compose.prod.yaml       the server: Postgres, migrations, and the app on the proxy network
Dockerfile              the built app and the bundled server in one image
server/
  app.ts                the /api routes, the origin check, error answers
  session.ts            who is signed in, asked of the account service
  snapshot.ts           an account's rows ⇄ a snapshot; saves only what changed
  validate.ts           what a saved snapshot may look like
  reference.ts          the shared vocabulary and demo tables
  db.ts, env.ts, main.ts  the pool and transactions, settings, startup and static files
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
  data/snapshot.ts      the Snapshot shape, shared by the app and the server
  engine/reel.ts        the machine: reels from the pantry, weighting, spin maths, dish naming
  state/planner.ts      all app state and every action over it
  lib/api.ts            same-origin requests to /api
  lib/account.ts        who is signed in, the sign-in link, signing out
  lib/remote.ts         load and save the signed-in account's snapshot
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

The browser never reaches the database. Everything it reads or saves goes through `server/`, which is where the security model lives.

## Design

The _2a Basket_ skin throughout: forest green on a `#efe9d9` ground, flat fills, no shadows, Gloock over Karla. A permanent sidebar rather than a drawer, because this is a desktop app. The layout came from the `desktop-version` branch; this is that design carried into the real app, with pantry-only reels and its own API behind it.

Design rules that are load-bearing, not decoration:

- **No sharp corners, no dashed borders.** Containers round to 44/30/24/22/20px; every button, pill, chip and switch is `999px`.
- **Body text sits at ≥4.5:1** against its actual background, headline-scale type at ≥3:1. The secondary inks were darkened once already — do not lighten them back.
- **Every tap target is ≥44px**, including the small `×` and `Stock` actions.
- **Keyboard focus is visible**: `:focus-visible { outline: 2px solid <accent>; outline-offset: 2px }`.

## Not built, deliberately

No onboarding. Cooking a dish takes one serving off each drawn item. A serving is one of the unit for pieces, bags and cans; for grams, kilograms, millilitres and litres it is set when the item is stocked, and _Into pantry_ from the shopping list uses the unit's default. An ingredient's category cannot be changed after it is created — remove the ingredient and add it again. There is no screen for adding a cooking method. A method is a row in `meal_planner_cooking_methods` with its `phrase`, so a new one is a migration that inserts it, and it shows up on Add ingredient after the deploy. The diet chips are not persisted.

Three things stay in code on purpose, because they are presentation rather than vocabulary. The first is the SVG icon drawings, keyed by the database's codes, with a plain plate for any dish style the app hasn't drawn. The second is the date presets on the stocking forms. The third is form copy such as "Use by" and "Gluten-free", which labels columns rather than naming anything. The three category codes are fixed as well, because the schema fixes them: an ingredient has one kind column per category, so a fourth category is a migration, not a row. Sync is last-write-wins with no realtime channel, so two devices editing at once will talk over each other. These are the obvious next increments, not oversights.
