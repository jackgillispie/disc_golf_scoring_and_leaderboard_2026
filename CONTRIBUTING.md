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
| `tests/` | Token-generation and stress-test utilities (automated tests arrive in phase 1) |
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
   cd app_files_for_netlify
   npm install
   netlify link    # link to the Netlify site (ask the owner for access)
   netlify dev     # serves app/ locally with functions and redirects
   ```
   The app needs a group token in the URL (`?g=<token>`). Check that the backend URL in `index.html` points at the environment you mean to test.

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

Automated tests (Jest for pure logic, plus a small smoke suite inside Apps Script) and CI arrive in **phase 1**. Until then:

- Test the scoring flow end to end with `netlify dev` against a **non-production** Apps Script project and Sheet.
- For burst/offline behaviour, see `tests/stress_test_disc.py`.
- Describe your manual test steps in the PR.

## Questions

Open an issue or ask the project owner. Decisions that change the roadmap should be recorded in `PLAN.md` (and in the decision log in `recommendations.md`).
