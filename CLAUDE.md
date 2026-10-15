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

## Checks before pushing

```sh
npm run lint      # typecheck (tsc -b)
npm test          # vitest
npm run build     # the app and the bundled server
```

`npm run check` runs Ultracite (oxlint + oxfmt) and is report-only; the PostToolUse hook in `.claude/hooks/ultracite.sh` runs it on every file you edit.

## Names

The name people see is `APP_NAME` in `src/lib/brand.ts`. The internal names (the image and network alias `sleepy-spinner`, the database `sleepy_spinner`, the server folder `/srv/sleepy-spinner`) keep the old name on purpose: renaming them would orphan the stored data. Leave them as they are.

## Database

Schema changes are new dbmate migrations in `db/migrations` (`npm run db:new`), never edits to ones already merged; commit the regenerated `db/schema.sql` with them. `npm run db:up` starts the local Postgres in Docker and applies them.

## Design

The app is styled in Cute Matcha's app look (the _Apps_ section of Irma's Cute Matcha design system), in both of its themes. Colours are the system's role tokens, named by job (`ground`, `panel`, `raised`, `text`, `text-muted`, `strong`, `on-strong`, `accent-soft`, `on-accent`, …), at the top of `src/styles.css`: Light Matcha on `:root`, Dark Matcha on `:root[data-theme="dark"]`. Pick a token by what the thing is, never a hex; text on `accent` or `accent-soft` is always `on-accent`, children included. `moss`, `gold`, `terracotta`, `cream` and `white` are fixed drawing colours, never text. The inline script in `index.html` sets `data-theme` before the first paint, from the visitor's saved choice or else the device's setting; `src/lib/theme.ts` keeps it, and the header's sun/moon pill saves a choice.

Every screen opens with the **Header** (`src/components/header.tsx`): the slot-machine icon (`src/components/app-icon.tsx`, the same drawing as `public/favicon.svg`), the name in Abril Fatface with "by Irma HS" under it, and the theme toggle. Abril Fatface for names and Lato for everything else, 2px outlines, flat panels with a filename on a `strong` pill (`.legend`), and `strong` with `on-strong` text for anything selected. Only the one action to press next in an area (`.btn`) carries the hard shadow.
