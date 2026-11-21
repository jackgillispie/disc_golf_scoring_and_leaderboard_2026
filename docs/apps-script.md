# Apps Script projects (clasp)

The Apps Script code lives in two separate projects. Each has its own folder and `clasp` config:

| Folder | Apps Script project | Contents |
|---|---|---|
| `apps_script/backend/` | **Disc 2026 Archive** (`1TQbjzi9…`) | Score intake (`doPost`), health check (`doGet`), TD Tools menu, leaderboard/hole-summary rebuilds, QR generation |
| `apps_script/leaderboard/` | **Disc 2026 Leaderboard** (`1dgllqYA…`) | Leaderboard web page (`doGet` serves `leaderboard.html`) |

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

- `.clasp.json`: links the folder to its Apps Script project by `scriptId`. It's safe to commit; the script ID isn't a credential.
- `.claspignore`: limits pushes to `appsscript.json`, `*.gs` and `*.html`.
- `appsscript.json`: the project manifest (time zone, runtime, advanced services, web app access).
  - Backend: enables the **Sheets** advanced service (used for QR-code formatting); web app access is currently `MYSELF`.
  - Leaderboard: no advanced services; web app access is currently `MYSELF`.
  - Before an event, web app access must be changed to allow players and the display screen in (and later, only the Netlify proxy). See `PLAN.md`, phase 3.

## Known limitations (to fix in later phases)

- Both projects call `SpreadsheetApp.getActiveSpreadsheet()`. That only works in a script **bound** to a spreadsheet, and both projects are standalone. Until the multi-event registry exists (`PLAN.md`, phase 4), they need either to be bound to the event Sheet or to open it by ID.
- `leaderboard_script.gs` makes a top-level call to `getLeaderboardData()`. That call runs on every execution of the leaderboard project.
