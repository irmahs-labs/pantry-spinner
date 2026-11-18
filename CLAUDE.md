# CLAUDE.md

## Git branches

Always pull before making changes: run `git fetch origin` and start from the latest `origin/main` before the first edit.

- On a branch whose PR is open, bring it up to date with `origin/main` first
- On `main`, or on a branch whose PR is already merged, create a new branch from `origin/main` instead

Always name the branch after the feature or fix it contains, never a random or generated name.

- Format: `<type>/<feature-name>` in lowercase kebab-case
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`
- Examples: `feat/shopping-list-export`, `fix/reel-settle-timing`, `docs/claude-md`
- If the session assigns a generic branch (for example `claude/<random-words>`), create a feature-named branch instead and push there

## Pull requests

- Never push to `main`. Every change goes in through a pull request.
- Open the PR and stop there: never merge it, not even when CI is green. Irma reviews and clicks merge.
- Deploys run on merge to `main`. Re-run a deploy only when Irma asks.

## The context graph and the notes

Irma's notes on every irmahs.dev app are in her Obsidian notes, the repo irmahs/my-obsidian-notes (checked out at `~/Dev/my-obsidian-notes`), under `Self Hosted/`.

- Before starting work, read `Self Hosted/Context Graph.md` from that repo's `origin/main`: how irmahs.dev and every subdomain fit together (the proxy, the account service, which app talks to which, where each keeps its data). Without a checkout, read it with `gh api repos/irmahs/my-obsidian-notes/contents/Self%20Hosted/Context%20Graph.md -H "Accept: application/vnd.github.raw"`.
- When a change alters what the app is or does, update the notes too:
  - `Apps.md`, the app's section;
  - `Technologies.md`, if it adds, removes or changes a technology;
  - `Context Graph.md`, if it changes a subdomain, a redirect, a link between apps, who asks whom (sign-in, admin checks, internal calls), or where data lives. Update both the graph and the table.
- The notes go in through their own pull request, like any other change: a branch from the notes repo's `origin/main`, never their `main`. The local checkout is often left on an old branch, so work in a `git worktree` of `origin/main` rather than touching it. Link the app's PR in the notes PR.

## Checks before pushing

```sh
npm run check     # Ultracite (oxlint + oxfmt); CI fails on it
npm run typecheck # tsc -b
npm test          # vitest
npm run build     # the app and the bundled server
```

The PostToolUse hook in `.claude/hooks/ultracite.sh` runs Ultracite and the typecheck on every file you edit.

## Names

The name people see is `APP_NAME` in `src/lib/brand.ts`. The internal names (the image and network alias `sleepy-spinner`, the database `sleepy_spinner`, the server folder `/srv/sleepy-spinner`) keep the old name on purpose: renaming them would orphan the stored data. Leave them as they are.

## Database

Schema changes are new dbmate migrations in `db/migrations` (`npm run db:new`), never edits to ones already merged; commit the regenerated `db/schema.sql` with them. `npm run db:up` starts the local Postgres in Docker and applies them.

## Languages

The app reads in English or French. The choice is `src/lib/language.ts`: kept in localStorage and in a `lang` cookie on `irmahs.dev` that every irmahs.dev app reads and writes, so one pick carries across the apps; the header's EN/FR pill (`src/components/language-toggle.tsx`) switches it. Every string a visitor sees has both versions, in a `COPY = { en, fr }` object beside the component that shows it (`useCopy(COPY)`). The vocabulary's words have a French twin column beside each English one (`label_fr`, `phrase_fr`, `name_template_fr`, …, and the demo's `name_fr`), which `toVocab` reads in French; French dish-name phrases never agree with the noun ("au four", "à la vapeur"), since an ingredient's gender is unknown.

## Design

The app is styled in Cute Matcha's app look (the _Apps_ section of Irma's Cute Matcha design system), in Light Matcha and Dark Matcha (a mid-tone matcha page, cards a step lighter, and the header, buttons and fields a darker well, with near-black outlines and shadows in both themes). Colours are the system's role tokens, named by job (`ground`, `panel`, `header`, `raised`, `text`, `text-muted`, `accent`, `on-accent`, `pop`, `on-pop`, `strong`, `selected`, …), at the top of `src/styles.css`: Light Matcha on `:root`, Dark Matcha on `:root[data-theme="dark"]`. Pick a token by what the thing is, never a hex: the one action to press next (`.btn`) is `pop`, the yellow accent, 48px tall with the hard shadow it sinks into when pressed, and nothing else is yellow, anything chosen or switched on (the current screen, a pressed chip, a held reel) is `selected`, legends and the flash are `strong`; text on `accent`, `accent-soft` or `selected` is `on-accent`/`on-selected`, children included. `moss`, `gold`, `terracotta`, `cream`, `ink` and `white` are fixed drawing colours, never page text. The inline script in `index.html` sets `data-theme` before the first paint, from the visitor's saved choice or else the device's setting; `src/lib/theme.ts` keeps it, and the header's sun/moon pill saves a choice.

Every screen opens with the **Header** (`src/components/header.tsx`): the slot-machine icon (`src/components/app-icon.tsx`, fixed Light Matcha colours with a `text` rim, the same drawing as `public/favicon.svg`), the name in Fredoka with "by Irma HS" under it, then the theme toggle and the **account pill** (`src/components/account-button.tsx`): "sign in" with Google's mark, or the person's picture and first name from `/api/me`, linking to the IrmaHS Labs account page. Fredoka sets titles and panel names, Nunito Sans everything else; 2px outlines, flat panels with a filename on a `strong` pill (`.legend`). Corners are concentric: panels are `--radius-panel` (20px) with 16px of padding on top and 12px elsewhere, and fields inside take `--radius-field` (8px). Nothing is italic, screen icons are a 24 grid at 2px, and the Footer says only 'more apps at irmahs.dev'.

## Footer and privacy

Every page ends with every irmahs.dev app and the legal pages (legal notice, privacy, terms of use, cookies), which live on irmahs.dev (`src/components/site-links.tsx`). Keep the app list the same, and in the same order, as irmahs-labs/landing-page `src/lib/site-links.ts`. The privacy policy there (`src/lib/legal.ts`) describes exactly what this app collects, sends and keeps in the browser: a change that adds a cookie, a localStorage key, a database column about people, or a request to another service updates it in the same change (a PR in irmahs-labs/landing-page). Nothing may need a consent banner: no analytics, ads or tracking cookies.
