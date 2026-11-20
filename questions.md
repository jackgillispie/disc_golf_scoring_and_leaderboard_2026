# Questions about PLAN.md and the project

Questions from reviewing `PLAN.md`, the directory layout, and the main source files (only as much as needed to understand the architecture). Nothing has been changed.

---

## 1. Architecture and source of truth

1. `PLAN.md` says the front-end web app is defined in Google Apps Script. In the repo, the player-facing scorer is `app_files_for_netlify/app/index.html` (served by Netlify), and Apps Script holds the backend (`AppsScript_Code.gs`) and the leaderboard page (`final_leaderboard.html` + `leaderboard_script.gs`). Which description is correct? Is "front-end" in the plan meant to cover only the leaderboard?
2. The Netlify "proxy" (`netlify/functions/save-score.js`) writes to **Airtable**, but the front end posts straight to the Apps Script URL, and the proxy URL is commented out. Is Airtable still in use, or was it dropped for Google Sheets? If the proxy is still "optional," when would it be turned on, and should it forward to Apps Script instead of Airtable?
3. Is the Google Sheet behind the Apps Script the one source of truth for scores? How does `Brackett's Bluff Tournament 2026.xlsx` relate to it (an export, a template, an archive)?
4. Are the `.gs` files in this repo kept in sync with the deployed Apps Script project by hand, or with a tool like `clasp`? Which copy wins if they differ?
5. Is there one Apps Script project (backend and leaderboard together) or two separate deployments? `leaderboard_script.gs` and `AppsScript_Code.gs` both define `doGet`.

## 2. Scope and priorities

6. The plan lists seven initiatives. What order do you want them in? Is there a date to hit, such as the next tournament?
7. Is the next milestone still the same single event (LKNITP / Brackett's Bluff), or does the app need to support several events or organizers soon? That affects how much of the "adaptable versions" and "registration" work comes first.
8. What does "done" look like for v2.0? Is it all seven initiatives, or a subset?
9. Who works on this besides you, and who will review PRs? `updatedPostMortem.txt` names collaborators. Does each initiative have its own owner?

## 3. Correctness, robustness, and testing

10. "Rewriting functions to be unit-testable in dev": which runtime and test framework do you want, e.g. Node + Jest/Vitest for the JS, with Apps Script globals mocked? Or a Python harness like the existing `tests/stress_test_disc.py`?
11. Front-end logic currently lives inline in a single ~2,000-line `index.html`. Can it be split into separate JS modules and/or given a build step, or does it need to stay one self-contained file (for Netlify free-tier limits, offline caching, or simplicity)?
12. The `tests/` folder holds mostly token lists, helper scripts, and a cert/key pair rather than automated tests. Should these be treated as test fixtures, as one-off utilities, or as candidates for a different folder? (Asking only to understand intent, not proposing a move.)
13. What failure modes matter most for "failure modes are well-defined"? Examples: lost connectivity, duplicate submissions, a wrong or switched token, a device swap mid-round, Apps Script quota or concurrency limits, a bad payload.
14. How should duplicate or resubmitted scores for the same group + hole be handled? The backend currently only appends rows (the delete-existing logic is commented out), and the TODO notes say "Don't overwrite unless submitted on that phone." Is "latest timestamp wins" the intended rule for the leaderboard?
15. Are Apps Script concurrency limits (e.g. `LockService`) and execution quotas a known concern at ~200 attendees and ~50 groups, or did the burst stress test show they're fine?
16. "Historically, only one person out of 50 has had issues." Do you know what that issue was, and should it be written up as a regression test case?

## 4. CI/CD and security

17. What should CI/CD run on: GitHub Actions, or Netlify's build pipeline? Is the repo hosted on GitHub, and is it public or private?
18. Which security checks do you want in CI: secret scanning, dependency audit (`npm audit`), ESLint (an `eslint.config.js` exists), SAST (CodeQL/Semgrep), or others?
19. `save-score.js` contains a hard-coded Airtable token, base ID, and table ID, and that file is tracked in git. Is that token still live? Has it been, or should it be, rotated? Is cleaning up git history in scope? (Flagging only, no action taken.)
20. Untracked files include `tests/key.pem` / `tests/cert.crt`, `.env`, and `lknitpdiscgolf2026.txt`. Are any of these sensitive? Should `.gitignore` explicitly cover them before CI or new contributors come in?
21. Should the Apps Script deployment URL (in `index.html`) be considered secret? It currently accepts any POST that has a valid group-name token.
22. Should deployment (Netlify site and Apps Script version) be automated by CI, or stay manual?

## 5. Admin score management

23. Who are the admins (tournament directors, volunteers?), and how technical are they? Would they rather work in Google Sheets or in a separate web app?
24. Which admin tasks hurt most today? The notes mention batch corrections, auditing which holes each team has completed, and OCR of paper cards. Anything else (e.g. adding or removing teams, merging duplicate teams, finalizing results)?
25. Should admin corrections keep the current immutable-audit-trail model (append-only raw scores plus correction records)?
26. If it becomes a separate web app, how should admins authenticate (Google account, the same auth as the "More professional auth" item)?

## 6. Adaptable versions (golf vs. disc golf, other courses)

27. How different are the "versions" expected to be? Only course data (holes, par, distance)? Scoring rules too (e.g. stroke vs. match play, team scramble vs. individual, handicaps)? Or UI and branding as well?
28. Hole data is currently hard-coded (e.g. `HOLES` in `rebuildHoleSummary`, vendor-logo-per-hole mapping in `index.html`). Should configuration live in a file per event, in the Sheet, or behind the proposed API?
29. For the "API that pulls in course info": do you have a specific provider in mind (e.g. UDisc, which `notes/TODO.txt` links to, or a golf course database)? Have you checked their terms and pricing? Would a manually entered course config be acceptable as a first step?
30. What does "topology" mean here: hole layout and coordinates, elevation, maps for the player?

## 7. Registration via Wix

31. Is Wix already the event's main website, or would it be added just for registration?
32. What should registration capture (team name, player names, contact info, sponsor/company affiliation)? Are there privacy or consent requirements for that data?
33. Teams currently get pre-assigned gnome-themed tokens and QR codes printed per hole, and the event notes say the "2 people per QR" model confused players. Should registration produce one QR per team, one per player, or something else?
34. How should Wix registration data reach the scoring backend: Wix Automations/webhooks to Apps Script, manual export, or the Wix API?
35. Is a paid Wix plan, or anything else that costs money, acceptable? The post-mortem stresses a $0 delivery cost.

## 8. Auth

36. What threat model are you designing for: casual misuse (scoring for the wrong team), deliberate tampering by attendees, or outside attackers? How much friction is acceptable for players on a course with spotty cell coverage?
37. What does "actual login method" mean to you: magic link / one-time code, OAuth (Google), per-team PIN, signed or expiring tokens in the QR URL?
38. Does auth need to work offline or with intermittent connectivity (e.g. authenticate once, then queue submissions)?
39. Should players be able to recover their session on a new device (noted in TODO as "A WAY TO GIVE USERS PAST DATA IF A DEVICE FAILS")?

## 9. User/vendor matchup insight

40. How would player and vendor locations on the course be known: inferred from the last hole submitted, device GPS, or vendor booths at fixed holes?
41. What would the "updates" to users and vendors be: in-app notifications, SMS/email, a vendor dashboard? Where would vendors see them?
42. What data are you allowed to collect and share about attendees with vendors? Is there consent or an opt-in, and is there a privacy policy that covers it?
43. How would matches be decided: user-declared interests at registration, company or industry info, or something else?
44. How will sponsor ROI be measured (logo impressions, clicks, matched conversations)? Is any analytics tracking expected?

## 10. Operational and environmental constraints

45. Are the free-tier limits (Netlify credits, Apps Script quotas, Wix) hard constraints for v2.0, or is some budget available now?
46. Must the app keep working when offline and sync later (the current retry/queue behaviour)? Is that a non-negotiable requirement for all future changes?
47. Which browsers and devices must be supported? The commit history mentions DuckDuckGo compatibility.
48. Is the live leaderboard (shown on a casting device at the event) in scope for any of these initiatives, e.g. auto-refresh or team names (both in the TODO)?

## 11. Repo housekeeping (clarification only)

49. Are the files in `notes/`, `scratchpad.py`, `netlify_log_data.txt`, `Notes for improvement.txt`, and `updatedPostMortem.txt` meant to stay in the repo as project history, or are they personal working notes?
50. Is `PLAN.md` meant to be the living roadmap that future PRs update, or a one-time brief?

---

## Responses (2026-11-20)

Summary of your answers. Full follow-ups and suggestions are in `recommendations.md`.

| # | Answer |
|---|---|
| 1 | Front end = `app_files_for_netlify/app/index.html`; leaderboard + backend = Apps Script |
| 2 | Airtable no longer used; proxy may be used to write to Sheets |
| 3 | Sheet is the source of truth; `.xlsx` is a snapshot + post-event analysis |
| 4 | Not using clasp yet, but will adopt it; local copy is the latest |
| 5 | **Two separate Apps Script projects** (corrected after §A check): backend and leaderboard each need their own clasp folder |
| 6 | No deadline; ordering suggested in recommendations §B |
| 7 | **Multiple events at the same time** (multi-tenant) |
| 8 | All seven initiatives |
| 9 | Collaborators TBD; setup must be well documented |
| 10 | Tests should run in an Apps Script-compatible JS environment; any approach that is documented is fine (§D) |
| 11 | Keep `index.html` as one file for now |
| 12 | Mostly leftovers from building tokens offline; unclear why the cert exists (§N) |
| 13 | Failure modes suggested in §C |
| 14 | Idea: first entry counts for the leaderboard, plus admin manual-edit tools. **Follow-up:** verified in §A |
| 15 | No issues at ~200 attendees / ~50 groups; must stay maintainable as it scales |
| 16 | A later submission was missing from the leaderboard; an admin fixed it manually (explained in §A) |
| 17 | GitHub |
| 18 | All of the suggested checks; priority order in §E |
| 19 | Done on branch `chore/remove-airtable-proxy-gitignore` (40f533c) |
| 20 | Done on same branch: `*.pem`, `*.crt`, `lknitpdiscgolf2026.txt` ignored (`.env` already was) |
| 21 | Apps Script URL likely should be secret (hence proxy) |
| 22 | Automated deployment |
| 23 | Non-technical admins; offer a choice of interfaces with the same features (§F) |
| 24 | Current list plus more (§F) |
| 25 | Keep the immutable audit trail |
| 26 | Same auth method as players |
| 27 | Versions differ in course data, scoring rules, branding |
| 28 | Alternatives discussed in §G |
| 29 | Data sources researched in §H |
| 30 | All of those; interactive "you are here" map (§H) |
| 31 | Wix sign-up with QR codes tied to sign-ups/teams; must also work on other platforms (§I) |
| 32–33 | Suggestions in §I |
| 34 | Wix webhooks should send data to Apps Script |
| 35 | Ideally no paid plan |
| 36 | Both threat types; no tolerance for friction (§J) |
| 37 | Any method resistant to likely attack vectors (§J) |
| 38 | Yes, auth must work offline |
| 39 | Yes, session recovery on a new device |
| 40 | Vendors at fixed holes; user location infers position |
| 41 | In-app notifications |
| 42–44 | Discussed in §K, §L, §M |
| 45 | Free tier |
| 46 | Offline + sync is required |
| 47 | WebKit, Chrome, DuckDuckGo, plus common iOS/Android combos |
| 48 | Leaderboard is in scope |
| 49 | Notes stay as project history |
| 50 | `PLAN.md` is the living roadmap |
