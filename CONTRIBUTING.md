# Contributing

Thanks for helping out. This guide gets you from a fresh clone to a working setup. For the product roadmap and the decisions behind it, read [`PLAN.md`](PLAN.md) first.

## Repository layout

| Path | What it is |
|---|---|
| `app_files_for_netlify/app/index.html` | Player scoring app (single self-contained file, hosted on Netlify) |
| `app_files_for_netlify/netlify.toml` | Netlify build, functions and redirect config |
| `app_files_for_netlify/netlify/functions/` | Netlify functions (configured in `netlify.toml`; currently empty. The proxy to Apps Script is rebuilt here in phase 3) |
| `apps_script/backend/` | Apps Script backend: score intake, TD Tools menu, leaderboard rebuilds |
| `apps_script/leaderboard/` | Apps Script leaderboard web page |
| `docs/` | Setup and workflow docs |
| `tests/unit/`, `tests/helpers/` | Jest unit tests and the Apps Script loader |
| `tests/` (other files) | Token-generation and stress-test utilities |
| `.github/` | CI workflows and Dependabot config |
| `notes/`, `updatedPostMortem.txt` | Project history and event notes |
| `PLAN.md`, `recommendations.md`, `questions.md` | Roadmap, decision log and review Q&A |

## Prerequisites

- **Git**
- **Node.js** (LTS) and npm
- **clasp** for Apps Script: `npm install -g @google/clasp`
- **Netlify CLI** for working on the front end locally: `npm install -g netlify-cli`
- **Python 3** for the scripts in `tests/`
- A Google account with Editor access to both Apps Script projects (ask the project owner)

## Getting set up

1. Clone the repo and create a branch (see [Workflow](#workflow)).
2. **Apps Script:** follow [`docs/apps-script.md`](docs/apps-script.md) (turn on the Apps Script API, `clasp login`, pull/push workflow).
3. **Front end:**
   ```sh
   node scripts/build-app.js staging   # copies the app to dist/netlify-staging, wired to the staging backend
   cd dist/netlify-staging
   netlify dev                         # serves app/ locally with redirects
   ```
   The app needs a group token in the URL (`?g=<token>`). Don't paste a backend URL into `index.html`. Its `__APPS_SCRIPT_URL__` placeholder is filled per environment by `scripts/build-app.js` (see [`docs/deployment.md`](docs/deployment.md)).

## Workflow

1. **Never commit directly to `main`.** Create a branch from `main`:
   - `feat/<short-name>` for new features
   - `fix/<short-name>` for bug fixes
   - `chore/<short-name>` for tooling, docs and cleanup
2. Keep each PR focused on one roadmap phase or task (see `PLAN.md`).
3. Write clear commit messages: an imperative summary line, then a short body explaining *why*.
4. Open a pull request against `main` and describe what changed and how you tested it.
5. If your change affects Apps Script, say in the PR whether it has been pushed with `clasp` and to which project. The repo must stay the source of truth. Never leave edits only in the online editor.

## Security rules (the repo is public)

- **Never commit secrets:** API tokens, keys, certificates, `.env` files or `~/.clasprc.json`. `.gitignore` covers the known ones. GitHub push protection will block most tokens, but don't rely on it.
- If a secret is committed by mistake, **revoke it first**, then tell the project owner. Removing it from git history comes second.
- Keep the existing input validation (alphanumeric allow-lists) in front of anything written to Sheets or rendered in the leaderboard.
- Personal data (names, emails, location) must follow the retention and consent decisions in `PLAN.md`.

## Constraints every change must respect

These are summarised from `PLAN.md`:

- **Free tier only** (Netlify, Apps Script, Wix).
- **Offline-first:** scoring must keep working without signal and sync later.
- **Multiple events at the same time.**
- **Browsers:** Safari/WebKit, Chrome and DuckDuckGo on iOS and Android, plus common desktop browsers.
- **`index.html` stays a single file** until the team decides otherwise.

## Testing

From the repo root:

```sh
npm install      # once: installs Jest + ESLint
npm run lint     # ESLint (Apps Script sources + tests)
npm test         # Jest unit tests in tests/unit
npm run check    # both, same as CI
```

**How the Apps Script code is tested.** Apps Script runs all files of a project in one shared global scope, and it runs on the V8 engine. `tests/helpers/loadAppsScript.js` loads the `.js` files into a Node `vm` sandbox the same way, with Apps Script services (`SpreadsheetApp`, …) stubbed out. So:

- Put logic in **pure functions** (no `SpreadsheetApp`, `ContentService`, etc.) and keep Sheets reads and writes in thin wrapper functions. The pure helpers are marked in each file.
- Add or extend tests in `tests/unit/` for every behaviour change.
- **Known bugs** are recorded as `test.failing(...)` with a `KNOWN BUG:` name. Each one states the *correct* behaviour and is expected to fail. When you fix the bug, Jest reports it; change `test.failing` to `test`.

**CI** (`.github/workflows/`) runs lint and tests, a gitleaks secret scan and CodeQL on every PR and push to `main`. Dependabot opens weekly dependency-update PRs. PRs should be green before merging.

**Staging and deploys.** Merges to `main` deploy the Apps Script code and the scoring app to **staging** automatically (https://lknitpdiscgolfstaging.netlify.app). Production waits for manual approval. After a backend change reaches staging, run `runSmokeTests` in the staging backend project (see [`docs/deployment.md`](docs/deployment.md)). For front-end changes, test the scoring flow end to end with `netlify dev` against staging. For burst and offline behaviour, see `tests/stress_test_disc.py`. Describe your manual test steps in the PR.

**Front-end lint.** `index.html` and `leaderboard.html` are linted too, but findings there are **warnings** for now. Don't add new ones, and fix nearby ones when you touch that code.

## Questions

Open an issue or ask the project owner. Decisions that change the roadmap should be recorded in `PLAN.md` (and in the decision log in `recommendations.md`).
