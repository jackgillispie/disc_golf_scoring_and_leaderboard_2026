# Disc Golf Scoring App: Plan

This is the living roadmap. Update it as decisions change. Detailed reasoning, options considered and the full decision log are in [`recommendations.md`](recommendations.md). The original Q&A is in [`questions.md`](questions.md).

## Overview

A disc golf scoring application built on Google Apps Script and Netlify.

| Part | Where | Notes |
|---|---|---|
| Player scoring app (front end) | `app_files_for_netlify/app/index.html`, hosted on Netlify | Single self-contained file for now |
| Backend (receives scores, admin tools) | Apps Script project "Disc 2026 Archive": `apps_script/backend/` | Managed with clasp; see `docs/apps-script.md` |
| Leaderboard | Apps Script project "Disc 2026 Leaderboard": `apps_script/leaderboard/` | Separate project and deployment, managed with clasp |
| Proxy | Netlify functions (to be rebuilt) | Will carry **all** traffic to Apps Script |
| Data | Google Sheets (source of truth) | `Brackett's Bluff Tournament 2026.xlsx` is a past-event snapshot with analysis |

Today, players get a QR code (a team-specific URL) to submit scores. The backend supports admin score correction. At the last event (~200 attendees, ~50 groups) one submission needed manual correction.

## Business value

- User engagement with vendor/sponsor brands through the app
- A better player experience than pencil-and-paper scoring

## Constraints (apply to every change)

- **Free tier only:** Netlify, Apps Script, Wix free plans.
- **Offline-first:** course coverage is spotty. Scoring, auth and sponsor logos must work offline and sync later.
- **Multiple events at the same time:** one Google Sheet per event, plus a central registry.
- **Browsers:** WebKit/Safari, Chrome, DuckDuckGo, and common iOS/Android combinations.
- **No-friction auth** that still resists deliberate tampering.
- **Public repo:** never commit secrets. CI enforces this.
- **Usable by unknown future collaborators:** everything must be documented and reproducible.

## Key decisions

- **Resubmissions:** the first submission to reach the server counts. Admin corrections are appended override records, never in-place edits. Resubmissions are flagged for review.
- **Invalid input:** reject it with a field-level error and log the rejected payload to a review tab.
- **Identity:** one QR/link per player, linked to a team. Signed, unguessable tokens. Admins use a token plus an approved Google account.
- **Config:** each event's course, scoring rules, branding and vendors are edited in an admin web form and saved to protected hidden tabs in that event's Sheet.
- **Location:** the last submitted hole is the baseline; GPS refines it if the player opts in. Only the inferred hole is sent to the server.
- **Map:** a cached, georeferenced course image first; live map tiles later.
- **Data retention:** personal data is kept until the next year's event (needs a privacy notice and an annual deletion step).
- **Tooling:** Jest unit tests plus an in-Apps-Script smoke suite. CI runs CodeQL, secret scanning/push protection, gitleaks, Dependabot and ESLint. `clasp` for each Apps Script project. Deploys go to staging automatically; production needs manual approval.

## Roadmap (in order)

0. **Foundation:** `.gitignore`, removal of the old Airtable proxy, `clasp` set up for both Apps Script projects, setup/contributing docs. *(Partly done.)*
1. **Tests + CI/CD:** refactor logic so it can be unit-tested, Jest tests, security checks, automated staging and production deploys.
2. **Correctness:** resubmission rule, append-only corrections, reject-and-log validation, the defined failure modes (see `recommendations.md` §C), edge cases.
3. **Auth:** signed per-player tokens scoped to an event, all traffic through the Netlify proxy, admin Google sign-in. This retires the guessable team-name tokens and the public Apps Script URL.
4. **Adaptable events and courses:** multi-event support (sheet per event + registry), admin config web form, course data (OpenStreetMap import or our own course builder), scoring rules and branding per event, golf vs disc golf.
5. **Registration:** Wix sign-up webhook → proxy → Apps Script; per-player QR delivered by email and at check-in. Platform-neutral adapters so other organisations' sign-up tools can plug in.
6. **Admin interface:** one admin API with two front ends (a Sheets sidebar and a web app): corrections, missing-holes matrix, outlier flags, token re-issue, results freeze/export, action log.
7. **Vendor/user matchup:** in-app recommendations (rules first, learning over time), interactive "you are here" map, sponsor ROI metrics (logo impressions, recommendations shown/accepted, verified vendor visits, opt-in leads).

## Open items

- Check that collecting all four ROI metrics fits free-tier quotas.
- Write the privacy notice and decide who runs the annual data deletion.
- Once the proxy is live, redeploy the Apps Script web app under a new URL.
