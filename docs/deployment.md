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
3. Share the **four standalone Apps Script projects** and each environment's **spreadsheet** with it as **Editor**. (The sheet's bound TD Tools script comes with the spreadsheet's sharing.) Pushing code needs edit access to the projects, and there's no narrower role. The spreadsheets need sharing because the live web apps **run as the deploy account** (see "Web app deployments").
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

## TD Tools menu (bound sheet script)

The **TD Tools** menu (Initialize sheets, Generate group URLs, Create QR Codes, Recalculate leaderboard, Correct a score) lives in `apps_script/sheet_menu/`: a tiny script **bound** to each event spreadsheet. A standalone project can't add a menu to a sheet or show its dialogs, so the bound script does that and forwards every item to the backend, which it uses as the Apps Script library **`Backend`**.

- **Same spreadsheet as the web app:** the backend code runs as a library, so it reads the **backend's** Script Properties (`SPREADSHEET_ID` etc.). The bound script needs no properties of its own.
- **Always current:** the library is in *development mode*, so it runs the backend's latest pushed code (what CI deploys). The trade-off: **everyone who uses the menu needs Editor on that environment's backend project.**
- **Per environment:** the committed `appsscript.json` points `Backend` at the staging backend. `deploy-apps-script.js` repoints it at the target environment's backend, and pushes it after the backend (`sheet_menu` comes after `backend` in `environments.json`). A project with `scriptId: null` is skipped.
- **First use:** each TD gets a one-time Google permissions prompt the first time they click a menu item.
- **Finding a sheet's bound script ID:** in the sheet, **Extensions → Apps Script → Project Settings → Script ID**. Opening Extensions → Apps Script on a sheet without one creates it.

## Web app deployments

Both manifests use `"access": "ANYONE_ANONYMOUS"`, because players and spectators aren't signed in to Google. After phase 3, only the proxy needs access. Both also use `"executeAs": "USER_DEPLOYING"`.

**Which account the web app runs as.** "User deploying" means whoever last updated the deployment. After the first CI deploy, that's the **deploy account**, and the deploy account then reads and writes the spreadsheet. Two things follow:

- The deploy account needs **Editor on that environment's spreadsheet**.
- The deploy account must **approve the project's permissions once**. Until it does, anonymous visitors get a Google **"Access Denied"** page (*"You need access"*), even though nothing is wrong with the code. The same page appears when anyone deploys a project they haven't approved. If a web app suddenly shows "Access Denied" after a deploy, check this first.

To approve permissions as the deploy account, open a private window and sign in **only** as the deploy account. Go to https://script.google.com/home → **Shared with me** and open the project. Pick a function (backend: `doGet`; leaderboard: `getLeaderboardData`) and click **Run**. Then click **Review permissions**, pick the deploy account, and choose **Advanced → Go to … (unsafe)** → **Allow**. ("Unsafe" only means Google hasn't verified the app; it's this repo's code.) One approval covers the whole project until its permissions change.

> **Wrong-account trap.** When several Google accounts are signed in to one browser, the Apps Script editor can **Run** (and create triggers) as the browser's *default* account, even when the page header shows the one you picked. The approval then goes to the wrong account: nothing errors, but the web app still shows "Access Denied". This happened during the production go-live: the backend worked after approval, the leaderboard didn't, because its approval ran as the owner. Use a private window signed in **only** to the intended account. To check, reload the web app's `/exec` URL in a signed-out window; it should load, not show "You need access".

Staging and production both have deployments for both projects, and the deploy account has approved all four.

## Production go-live checklist

Production went live on 2026-11-27 by following these steps. They stay here for a fresh environment or a rebuild. Without a backend `deploymentId`, a production deploy only pushes Apps Script code, and the Netlify step skips with *"production has no backend deploymentId"*. To bring production live (before an event):

**1. Production spreadsheet** (comes with the event, phase 4)
1. Create the event spreadsheet.
2. Share it with the deploy account as **Editor**.

**2. Script Properties** on **Disc 2026 Archive** and **Disc 2026 Leaderboard**

| Property | Disc 2026 Archive | Disc 2026 Leaderboard |
|---|---|---|
| `SPREADSHEET_ID` | the new sheet's ID | the new sheet's ID |
| `ENVIRONMENT` | `production` | `production` |
| `APP_BASE_URL` | `lknitpdiscgolf.netlify.app` | not needed |

**3. TD Tools menu**
1. In the production sheet, open **Extensions → Apps Script**. This creates the sheet's bound script. Copy its **Script ID** from **Project Settings**.
2. Put it in `environments.json` as `production.projects.sheet_menu.scriptId` (same PR as step 6).
3. Give every TD who will use the menu **Editor** on **Disc 2026 Archive** (see "TD Tools menu" above).

After the approved deploy, reload the sheet: **TD Tools** appears in the menu bar.

**4. Approve permissions**
1. As **yourself (the owner)**, approve both projects: open each one, Run `doGet` / `getLeaderboardData`, and Allow. The first deployment is yours, so this keeps it working until CI takes over.
2. As the **deploy account**, approve both projects in the same way (see "Which account the web app runs as" above). Use a private window signed in only as the deploy account: see the **wrong-account trap** there.

**5. Create the two web-app deployments** (once, as the owner)

The latest code must already be in production, which a normal approved deploy does. Then, for each project, in an empty temp folder:
```sh
# .clasp.json: {"scriptId": "<production scriptId from environments.json>", "rootDir": ""}
clasp create-version "production initial web app"
clasp create-deployment -V <version number printed above> -d "production web app"
```
Each command prints a deployment ID starting with `AKfy…`. Alternatively, in the editor use **Deploy → New deployment → Web app**, with "Execute as: Me" and "Who has access: Anyone".

**6. Record the IDs**

In `apps_script/environments.json`, set `production.projects.backend.deploymentId`, `production.projects.leaderboard.deploymentId` and `production.projects.sheet_menu.scriptId` (step 3). Open a PR and merge it.

**7. Approve the production deploy**

The merge starts the "Deploy" workflow. When production asks for approval, approve it. It then:
- pushes the TD Tools script to the production sheet.
- updates both production web apps to the latest code. From now on they run as the deploy account, which step 3 prepared.
- builds the scoring app with the production backend URL and publishes it to https://lknitpdiscgolf.netlify.app. This is the first time the production site is deployed by the workflow.

**8. Check it works**
- `https://script.google.com/macros/s/<backend deploymentId>/exec` returns `{"status":"alive",…}`.
- `https://script.google.com/macros/s/<leaderboard deploymentId>/exec` shows the leaderboard, not "Access Denied".
- The page source of https://lknitpdiscgolf.netlify.app contains the production backend URL in `APPS_SCRIPT_URL`.
- Submit one test score through `https://lknitpdiscgolf.netlify.app/?g=<a group token>`, check it reaches the production sheet, then delete that row. (`runSmokeTests` only runs in staging.)

**9. Keep the leaderboard up to date**

`doPost` only appends to Raw Scores. The Leaderboard and Hole Summary sheets, which the leaderboard page reads, are rebuilt by `rebuildSteps()`. In **Disc 2026 Archive**, open **Triggers** (clock icon) → **Add Trigger**: function `rebuildSteps`, event source **Time-driven**, e.g. every minute during the event. The trigger runs as whoever creates it, so that account needs Editor on the sheet and must have approved the project's permissions. Create it in a private window signed in only as that account (see the **wrong-account trap** above), and check the trigger list shows the account you expect. Staging needs the same trigger if you want its leaderboard to update on its own.

**10. Hand out links**

In the production sheet, run **TD Tools → Generate group URLs** and **TD Tools → Create QR Codes**. They use `APP_BASE_URL`, so every link points at https://lknitpdiscgolf.netlify.app.

