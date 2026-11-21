# Apps Script projects (clasp)

The Apps Script code lives in two separate projects. Each has its own folder and `clasp` config, and each exists in a **staging** and a **production** copy (IDs in `apps_script/environments.json`; see [`deployment.md`](deployment.md)):

| Folder | Contents | Staging project | Production project |
|---|---|---|---|
| `apps_script/backend/` | Score intake (`doPost`), health check (`doGet`), TD Tools menu, leaderboard/hole-summary rebuilds, QR generation, smoke tests | Disc 2026 Backend (staging) | Disc 2026 Archive |
| `apps_script/leaderboard/` | Leaderboard web page (`doGet` serves `leaderboard.html`) | Disc 2026 Leaderboard (staging) | Disc 2026 Leaderboard |

**The `.clasp.json` in each folder points at STAGING.** `clasp push` from a folder only ever updates staging. Production is deployed with `node scripts/deploy-apps-script.js production` or by the GitHub workflow (see `deployment.md`).

**History:** both scripts used to live together in "Disc 2026 Archive". The combined code is saved there as **version 2, "pre-split snapshot"**. The live 2026 event project was taken down; the Archive copy is the source these folders came from.

The repo is the source of truth. Edit locally, then push. Never edit in the online editor without pulling the change back into git straight away.

## One-time setup

1. Install Node.js (LTS), then clasp: `npm install -g @google/clasp`. These docs were written against clasp **3.4.1**.
2. Turn on the Apps Script API for your Google account: https://script.google.com/home/usersettings → **Google Apps Script API: On**. It can take a few minutes to take effect.
3. Log in: `clasp login`. This opens a browser. Credentials are saved to `~/.clasprc.json` in your home folder. **Never copy that file into the repo.**
4. Ask the project owner to share both Apps Script projects with your Google account (Editor).

## Everyday workflow

Run commands from inside the project folder (`apps_script/backend` or `apps_script/leaderboard`):

```sh
clasp status   # which local files would be pushed (local check, no API call)
clasp pull     # download the online project (overwrites local files: commit first!)
clasp push     # upload local files; REPLACES the whole online project
```

> ⚠️ `clasp push` deletes any online file that doesn't exist locally. Always `git commit` (or at least `git stash`) before `clasp pull`, and check `clasp status` before `clasp push`.

## Versions and deployments

```sh
clasp version "description"            # immutable snapshot of the current code
clasp deployments                      # list deployments (web app URLs)
clasp redeploy <deploymentId> -V <n>   # point an existing web app URL at version n
```

Updating an existing deployment keeps its URL. Creating a new deployment creates a new URL, and the front end (or the proxy) would then need updating.

## Files in each folder

- `.clasp.json`: links the folder to its **staging** Apps Script project by `scriptId`. It's safe to commit; the script ID isn't a credential.
- `environment.js`: `getEventSpreadsheet()` and `getEnvironmentName()`, which read the Script Properties `SPREADSHEET_ID` and `ENVIRONMENT`. Both folders hold an identical copy; a unit test enforces this.
- `smoke_tests.js` (backend only): `runSmokeTests()`, which only runs when `ENVIRONMENT=staging`.
- `.claspignore`: limits pushes to `appsscript.json`, `*.js`, `*.gs` and `*.html`.
- Source files use the **`.js`** extension locally so ESLint, Jest and CodeQL can read them. clasp drops the extension on push, so the file names in the online editor are unchanged (e.g. `AppsScript_Code`).
- `appsscript.json`: the project manifest (time zone, runtime, advanced services, web app access).
  - Backend: enables the **Sheets** advanced service (used for QR-code formatting); web app access is currently `MYSELF`.
  - Leaderboard: no advanced services; web app access is currently `MYSELF`.
  - Before an event, web app access must be changed to allow players and the display screen in (and later, only the Netlify proxy). See `PLAN.md`, phase 3.

## Known limitations (to fix in later phases)

- The spreadsheet is chosen by the `SPREADSHEET_ID` Script Property, one per environment. The multi-event registry replaces this in phase 4.
- Known bugs found by the unit tests (token format mismatch with the front end, duplicate tokens, and others) are listed as `test.failing` in `tests/unit/backend.test.js`. They're fixed in phase 2.
