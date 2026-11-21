# Environments and deployment

## Environments

All IDs live in [`apps_script/environments.json`](../apps_script/environments.json).

| Environment | Backend project | Leaderboard project | Spreadsheet |
|---|---|---|---|
| **staging** | Disc 2026 Backend (staging) | Disc 2026 Leaderboard (staging) | Disc 2026 Staging |
| **production** | Disc 2026 Archive | Disc 2026 Leaderboard | *not set yet* (comes with the next event, phase 4) |

> The `.clasp.json` in each `apps_script/<project>/` folder points at **staging**. A plain `clasp push` from a project folder therefore can never touch production. Production is only deployed through the script or workflow below.

## How code reaches Google

```
PR merged to main
  └─ GitHub Actions "Deploy Apps Script"
       ├─ checks      lint + unit tests
       ├─ staging     pushes both projects to staging (automatic)
       └─ production  pushes both projects to production (waits for your approval)
```

The same script works by hand (needs `clasp login`):

```sh
node scripts/deploy-apps-script.js staging                 # both projects
node scripts/deploy-apps-script.js staging --project backend
node scripts/deploy-apps-script.js production              # only if you really mean it
```

The script copies each project folder to a temp dir, writes a `.clasp.json` for the target environment and runs `clasp push`. If the environment's project has a `deploymentId` in `environments.json`, it also creates a version and updates that web-app deployment, so the URL doesn't change. With `deploymentId: null` it only pushes code.

## One-time setup

### 1. Script Properties (all four projects)

Both projects find their spreadsheet through `getEventSpreadsheet()` (`apps_script/*/environment.js`). In each project open **Project Settings → Script Properties** and add:

| Project | `SPREADSHEET_ID` | `ENVIRONMENT` | `APP_BASE_URL` |
|---|---|---|---|
| Disc 2026 Backend (staging) | staging sheet ID (in `environments.json`) | `staging` | staging scoring app address (see below) |
| Disc 2026 Leaderboard (staging) | staging sheet ID | `staging` | not needed |
| Disc 2026 Archive | production sheet ID (when it exists) | `production` | `lknitpdiscgolf2026.netlify.app` |
| Disc 2026 Leaderboard | production sheet ID (when it exists) | `production` | not needed |

A sheet ID is the long string in its URL: `docs.google.com/spreadsheets/d/<ID>/edit`.

`APP_BASE_URL` is the address of the player scoring app (Netlify). The backend's **TD Tools → Generate group URLs** and **Create QR Codes** build each group's link from it. `https://` and a trailing `/` are optional. There is no default: if it isn't set, those tools stop with an error instead of handing out production links from staging. The smoke tests check it's set, and in staging that it isn't the production site.

### 2. Deploy account for GitHub Actions

CI logs in to clasp as a **dedicated Google account**, not a personal one. If the secret ever leaks, the damage stays limited to these projects.

1. Create a Google account for deployments (e.g. a "disc golf deploy bot").
2. Signed in as that account, turn on the Apps Script API: https://script.google.com/home/usersettings
3. Share the **four Apps Script projects** and the **staging spreadsheet** with it as **Editor**. It needs nothing else.
4. On your machine, log clasp in as the bot, copy its credentials, then switch back:
   ```sh
   clasp logout
   clasp login            # sign in as the deploy account
   cat ~/.clasprc.json    # copy the whole JSON
   clasp logout
   clasp login            # sign back in as yourself
   ```
5. In GitHub go to **Settings → Environments** and create two environments:
   - `staging`: add secret **`CLASPRC_JSON`** = the copied JSON.
   - `production`: add the same **`CLASPRC_JSON`** secret, and under **Deployment protection rules** tick **Required reviewers** and add yourself. Production deploys then wait for your approval.

Until `CLASPRC_JSON` is set, the deploy jobs skip with a warning instead of failing.

### 3. Authorise and run the smoke tests (staging)

1. Open **Disc 2026 Backend (staging)** in the Apps Script editor.
2. Select `runSmokeTests` and click **Run**. The first run asks for permissions (Sheets, script properties); approve them.
3. The execution log lists `PASS`/`FAIL` per check. The run fails if any check fails. Test rows are deleted afterwards.

Run the smoke tests after each staging deploy that changes backend behaviour, until they are automated.

## Where each URL lives

The scoring app (Netlify) and the Apps Script backend each need the other's address. The workflow above deploys **only** Apps Script; Netlify publishes `app_files_for_netlify/app` itself (`netlify.toml`).

| Link | Set in | Staging | Production |
|---|---|---|---|
| Backend → scoring app (group links, QR codes) | Script Property `APP_BASE_URL` on the backend project | not set up yet: needs a staging Netlify site or branch deploy | `lknitpdiscgolf2026.netlify.app` |
| Scoring app → backend (score submissions) | `APPS_SCRIPT_URL` constant in `app_files_for_netlify/app/index.html` | none: no staging web-app deployment yet | hard-coded; currently the **old, taken-down** deployment, so it must be updated before the next event |
| Leaderboard page | the leaderboard project's web-app deployment URL | none yet | none yet |

**Phase 3** replaces the hard-coded `APPS_SCRIPT_URL`: the Netlify proxy holds the backend address on the server (a Netlify environment variable per site or deploy context), and the browser never sees it.

## Web app deployments

No project has a production web-app deployment yet, and web-app access is `MYSELF` in both manifests. Before an event:

1. Change `webapp.access` in the manifest. Players need access until the proxy exists; after phase 3, only the proxy will.
2. Create a deployment once (`clasp deploy` or **Deploy → New deployment** in the editor).
3. Put its ID in `environments.json` as `deploymentId`. From then on every deploy updates it in place.
