# Environments and deployment

## Environments

All IDs live in [`apps_script/environments.json`](../apps_script/environments.json).

| Environment | Scoring app (Netlify) | Backend project | Leaderboard project | Spreadsheet |
|---|---|---|---|---|
| **staging** | https://lknitpdiscgolfstaging.netlify.app | Disc 2026 Backend (staging) | Disc 2026 Leaderboard (staging) | Disc 2026 Staging |
| **production** | https://lknitpdiscgolf.netlify.app | Disc 2026 Archive | Disc 2026 Leaderboard | *not set yet* (comes with the next event, phase 4) |

> The `.clasp.json` in each `apps_script/<project>/` folder points at **staging**. A plain `clasp push` from a project folder therefore can never touch production. Production is only deployed through the scripts or workflow below.

## How code reaches Google and Netlify

```
PR merged to main
  └─ GitHub Actions "Deploy"
       ├─ checks      lint + unit tests
       ├─ staging     both Apps Script projects, then the staging Netlify site (automatic)
       └─ production  both Apps Script projects, then the production Netlify site (waits for your approval)
```

Neither Netlify site is connected to Git. Only this workflow publishes them, so nothing reaches the live site without your approval.

The same scripts work by hand (they need `clasp login` / `netlify login`):

```sh
node scripts/deploy-apps-script.js staging                 # both projects
node scripts/deploy-apps-script.js staging --project backend
node scripts/deploy-netlify.js staging                     # build + publish the scoring app
node scripts/deploy-apps-script.js production              # only if you really mean it
```

`deploy-apps-script.js` copies each project folder to a temp dir, writes a `.clasp.json` for the target environment and runs `clasp push`. If the environment's project has a `deploymentId` in `environments.json`, it also creates a version and updates that web-app deployment, so the URL doesn't change. With `deploymentId: null` it only pushes code.

`deploy-netlify.js` builds the scoring app with `scripts/build-app.js`:
1. It copies `app_files_for_netlify/` to `dist/netlify-<env>/`.
2. It replaces the `__APPS_SCRIPT_URL__` placeholder in `index.html` with that environment's backend web-app URL, `https://script.google.com/macros/s/<backend deploymentId>/exec`.
3. It publishes the result to the environment's site (`netlify.siteId`).

If the environment has no backend `deploymentId` yet, the Netlify deploy is **skipped**. That way the live site is never replaced by a page with no backend.

To try the app locally against staging, run `node scripts/build-app.js staging`, then `cd dist/netlify-staging && netlify dev`.

## One-time setup

### 1. Script Properties (all four projects)

Both projects find their spreadsheet through `getEventSpreadsheet()` (`apps_script/*/environment.js`). In each project open **Project Settings → Script Properties** and add:

| Project | `SPREADSHEET_ID` | `ENVIRONMENT` | `APP_BASE_URL` |
|---|---|---|---|
| Disc 2026 Backend (staging) | staging sheet ID (in `environments.json`) | `staging` | `lknitpdiscgolfstaging.netlify.app` |
| Disc 2026 Leaderboard (staging) | staging sheet ID | `staging` | not needed |
| Disc 2026 Archive | production sheet ID (when it exists) | `production` | `lknitpdiscgolf.netlify.app` |
| Disc 2026 Leaderboard | production sheet ID (when it exists) | `production` | not needed |

A sheet ID is the long string in its URL: `docs.google.com/spreadsheets/d/<ID>/edit`.

`APP_BASE_URL` is the address of the player scoring app (Netlify). The backend's **TD Tools → Generate group URLs** and **Create QR Codes** build each group's link from it. `https://` and a trailing `/` are optional. There is no default: if it isn't set, those tools stop with an error instead of handing out production links from staging. The smoke tests check that it's set, and in staging that it isn't the production site.

### 2. Deploy account for GitHub Actions

CI logs in to clasp as a **dedicated Google account**, not a personal one. If the secret ever leaks, the damage stays limited to these projects.

1. Create a Google account for deployments (e.g. a "disc golf deploy bot").
2. Signed in as that account, turn on the Apps Script API: https://script.google.com/home/usersettings
3. Share the **four Apps Script projects** with it as **Editor**. Pushing code needs edit access, and there's no narrower role. Also share the **staging spreadsheet**, in case the web app ends up running as the deploy account (see "Web app deployments").
4. On your machine, log clasp in as the bot, copy its credentials, then switch back:
   ```sh
   clasp logout
   clasp login            # sign in as the deploy account
   clasp list             # should list the shared projects
   cat ~/.clasprc.json    # copy the whole JSON (PowerShell: Get-Content $HOME\.clasprc.json -Raw | Set-Clipboard)
   clasp logout
   clasp login            # sign back in as yourself
   ```
5. In GitHub go to **Settings → Environments** and create two environments:
   - `staging`: add secret **`CLASPRC_JSON`** = the copied JSON.
   - `production`: add the same **`CLASPRC_JSON`** secret. Under **Deployment protection rules**, tick **Required reviewers** and add yourself. Production deploys then wait for your approval.

### 3. Netlify token for GitHub Actions

Both sites must be in a team that one Netlify user can reach.

1. In Netlify, open your avatar → **User settings → Applications → Personal access tokens → New access token**. Give it a clear description and an expiry (e.g. 1 year, with a calendar reminder), and copy it.
2. In GitHub, add it as the secret **`NETLIFY_AUTH_TOKEN`** in **both** the `staging` and `production` environments.

The token can reach every site of that Netlify user, so keep only event sites there. If it leaks, delete it in Netlify and add a new one.

Until `CLASPRC_JSON` or `NETLIFY_AUTH_TOKEN` is set, that part of the deploy is skipped with a warning instead of failing.

### 4. Authorise and run the smoke tests (staging)

1. Open **Disc 2026 Backend (staging)** in the Apps Script editor.
2. Select `runSmokeTests` and click **Run**. The first run asks for permissions (Sheets, script properties); approve them.
3. The execution log lists `PASS`/`FAIL` per check. The run fails if any check fails. Test rows are deleted afterwards.

Run the smoke tests after each staging deploy that changes backend behaviour, until they are automated.

## Where each URL lives

The scoring app (Netlify) and the Apps Script backend each need the other's address.

| Link | Set in | Staging | Production |
|---|---|---|---|
| Backend → scoring app (group links, QR codes) | Script Property `APP_BASE_URL` on the backend project | `lknitpdiscgolfstaging.netlify.app` | `lknitpdiscgolf.netlify.app` |
| Scoring app → backend (score submissions) | backend `deploymentId` in `environments.json`, filled into `index.html` at deploy time | staging backend deployment | none yet: with no production deployment, the production site isn't redeployed |
| Leaderboard page | leaderboard `deploymentId` in `environments.json` (`…/macros/s/<id>/exec`) | staging leaderboard deployment | none yet |

**Phase 3** moves the backend address out of the page. The Netlify proxy holds it on the server, and the browser never sees it.

## Web app deployments

Both manifests use `"access": "ANYONE_ANONYMOUS"`, because players and spectators aren't signed in to Google. After phase 3, only the proxy needs access. Both also use `"executeAs": "USER_DEPLOYING"`.

Staging has deployments for both projects. Production has none yet. To create one (before an event):

1. Push the code to that environment, with `deploy-apps-script.js` or the workflow.
2. **Authorise the project as its owner first.** Open it in the editor and run any function that uses the spreadsheet, e.g. `getLeaderboardData` in the leaderboard or `runSmokeTests` in staging. A web app that runs as its deployer shows anonymous visitors an "Access Denied" page until the deployer has granted its permissions.
3. Create the deployment once. Either use **Deploy → New deployment** in the editor (type **Web app**), or, in a temp folder holding a `.clasp.json` for that project, run `clasp create-version "…"` then `clasp create-deployment -V <version> -d "<env> web app"`.
4. Put its ID in `environments.json` as `deploymentId`. From then on, every deploy updates it in place (same URL), and the Netlify deploy points the scoring app at it.
