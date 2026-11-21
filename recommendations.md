# Recommendations and follow-ups

This responds to your answers in `questions.md` (recorded at the bottom of that file). Nothing in the codebase has been changed. This document covers the two items you asked me to verify and the suggestions you asked for. The section numbers point back to the question numbers.

---

## A. Verification results

### Q5: one Apps Script project? It probably isn't one working project as written

If `AppsScript_Code.gs` and `leaderboard_script.gs` really are in the **same** Apps Script project, the leaderboard can't work as written.

- All `.gs` files in a project share one global scope. Both files define `doGet()`, and whichever file loads last silently replaces the other. So the web app URL serves **either** the health check (`{status: 'alive'}`) **or** the leaderboard page, never both.
- `leaderboard_script.gs` ends with a bare top-level call, `getLeaderboardData()`. Top-level code runs on **every** execution in the project, so every score `doPost` would also read the whole Leaderboard sheet and log it. That costs quota and adds latency under burst load.
- `leaderboard_script.gs` serves `'leaderboard'`, but the local file is named `final_leaderboard.html`. Since the local copy is supposed to be the latest, one of the two names is out of date.

**How to confirm:** in the Apps Script editor, check the file list, then go to *Deploy → Manage deployments*. If you see two deployments from two projects (or a project bound to a different sheet), the code works as two projects and the local folder just mixes them. Either way, the fix is to decide on one layout before setting up `clasp`. One `clasp` project maps to one Apps Script project. Two projects means two folders, each with its own `.clasp.json`.

### Q14 / Q16: how resubmissions work today

| Behaviour | Where | Effect |
|---|---|---|
| Every submission is appended; nothing is deleted | `writeScore` | Raw Scores keeps every attempt (good for auditing) |
| Leaderboard counts the **first row per Group + Hole, in sheet order** | `rebuildLeaderboard` (`holes` Set) | "First entry wins" is **already** the effective rule, but by *server arrival order*, not by the client timestamp |
| Hole Summary counts **every** row, duplicates included | `rebuildHoleSummary` | Averages and birdie counts double-count resubmissions, so they disagree with the leaderboard |
| Player names come from the first row for each new hole only | `rebuildLeaderboard` | Matches your TODO note: names update only when a *new* hole arrives |
| `correctScore` **overwrites** the first matching raw row | `correctScore` | Breaks the immutable audit trail you want to keep (Q25). The original value is lost |
| `correctScore` asks for "Group name (e.g. Card 3)" but groups are stored like `1A` | `correctScore` | Admins can easily type a value that never matches |
| A Group that fails the regex is stored as `null` | `writeScore` | All rejected groups would merge into one `"null"` team on the leaderboard |

**Q16 explained:** the player's second submission for a hole was saved in Raw Scores, but the leaderboard ignores everything after the first row. So the second submission didn't show up until an admin corrected it.

**Decision needed:** "first entry wins" has two possible meanings when submissions are queued offline:

- **(a) First to reach the server.** This is what happens now. It's simple, but a phone that was offline can lose to a later correction from another device.
- **(b) Earliest client timestamp.** This is closer to what the player meant, but it trusts the device clock.

Recommendation: use (a) for the automatic leaderboard. Make every admin correction an **appended correction record** that overrides it, never an in-place edit. Show "has resubmissions" as a flag in the admin view so they can be reviewed on game day.

---

## B. Suggested ordering for the seven initiatives (Q6)

Each phase sets up the next. Multi-event support comes before registration and auth because both need an event/team data model to attach to.

| Phase | Work | Why here |
|---|---|---|
| **0. Foundation** | `.gitignore` fixes, remove dead Airtable code (Q19), `clasp` setup, resolve the Q5 project layout, `CONTRIBUTING.md` / setup docs | Unknown future collaborators (Q9) need a reproducible setup first |
| **1. Testability + CI** | Refactor pure logic out of Apps Script calls, unit tests, CI security checks, automated deploy (Q22) | Every later change is safer once there is a test net |
| **2. Correctness** | Settle the resubmission rule (above), implement and test the failure modes in section C, fix the audit-trail break | Fixes known bugs before the data model grows |
| **3. Event/course config** ("adaptable versions") | Config model for course data, scoring rules, branding; multi-event support | Registration, auth and admin all depend on "event" and "team" entities |
| **4. Auth** | Signed per-player/per-team tokens through the Netlify proxy | Needs the data model; must exist before registration hands out credentials |
| **5. Registration (Wix → Apps Script)** | Webhook ingestion, team formation, QR delivery | Uses auth tokens and the event model |
| **6. Admin interface** | Shared admin API, then Sheets sidebar and web app front ends | Can be built partly in parallel with phases 4–5; final shape depends on them |
| **7. Vendor/user matchup** | Location, recommendations, notifications, ROI metrics | Depends on config (vendor holes, map), registration (interests, consent), and auth |

---

## C. Expected failure modes (Q13)

Each one should have defined, tested behaviour:

**Network / client**
1. Offline at submit time: queue locally, retry with backoff (exists today; needs tests).
2. Request reaches the server but the response is lost: the client retries, which creates a duplicate. Needs an **idempotency key** (e.g. client-generated submission ID) so the server can drop exact replays.
3. Burst traffic: Apps Script concurrency/quota errors, so the retry must not stampede (add jitter).
4. App closed or page reloaded with unsent scores still queued: the queue must survive in `localStorage`.
5. `localStorage` unavailable or cleared (private mode, iOS storage eviction, the "clear data" warning).
6. Device lost or swapped mid-round (Q39).
7. Wrong QR scanned, or the URL changes mid-round (the "sticky token" issue in TODO).
8. Back-button / navigation loses URL params (TODO note).
9. Device clock is wrong (affects client timestamps).
10. Logo/image CDN unreachable: scoring must still work.

**Data**
11. Duplicate submission for the same hole (same or different device).
12. Out-of-range values: hole > course length, score 0 or > a sane cap, wrong par for that hole.
13. Field fails validation, so it is currently stored as `null` silently. Should it be rejected with an error instead?
14. Players or team name changed mid-round.
15. Frontend and backend token/config lists drift apart (TODO note).

**Server / ops**
16. Apps Script quota exhausted (daily URL fetch, execution time, simultaneous executions).
17. Concurrent writes and leaderboard rebuild running while scores arrive (consider `LockService`).
18. Sheet renamed, columns reordered, or someone edits Raw Scores by hand.
19. A bad deployment: rollback path (Apps Script versioned deployments).
20. Netlify free-tier limits hit (functions, bandwidth).
21. Venue internet/hotspot outage for the leaderboard display (event note).

---

## D. Testing approach (Q10)

Apps Script runs on V8, so plain modern JS that avoids Apps Script services runs the same in Node.

Recommended setup:
1. **Pure functions** (validation, leaderboard aggregation, resubmission resolution, scoring rules) live in `.gs` files with **no** calls to `SpreadsheetApp` and similar. Thin wrapper functions handle sheet I/O.
2. **Unit tests in Node** (Vitest or Jest). Load the `.gs` files with Node's `vm` module and stub the Apps Script globals. This is fast, runs in CI, and needs no Google credentials.
3. **A small in-Apps-Script smoke suite** (a `runTests()` function plus a tiny assertion helper, or QUnitGS2) that runs against a **test copy** of the spreadsheet. It catches real service behaviour such as quotas, date handling and permissions. You run it from the editor, or through `clasp run`, which needs a GCP project and an API-executable deployment, so it's harder to do in CI.
4. **Frontend:** keep the single file (Q11) but put logic in clearly separated functions so a test harness (e.g. jsdom or Playwright) can drive it. Cross-browser checks (Q47) are best done with Playwright, which covers Chromium and WebKit; DuckDuckGo uses the system engine, WebKit on iOS and Chromium WebView on Android.

---

## E. CI/CD checks, in priority order (Q18, Q22)

1. **Secret scanning.** Turn on GitHub secret scanning + push protection, and run `gitleaks` in CI. This would have caught the Airtable token.
2. **Unit tests** (section D) on every PR.
3. **Lint.** ESLint (config already exists) with Apps Script globals declared; also lint the inline script in `index.html`.
4. **Dependency audit.** Dependabot alerts + `npm audit --audit-level=high`.
5. **SAST.** CodeQL is free for public repos; for a private repo, Semgrep Community Edition is a free alternative.
6. **Deploy.**
   - Netlify: connect the GitHub repo, so pushes to `main` deploy and PRs get preview deploys.
   - Apps Script: a GitHub Action runs `clasp push` + `clasp deploy` on merge to `main`. This needs clasp credentials stored as a GitHub secret, with care about token expiry. Deploy to a *staging* Apps Script project/spreadsheet first if possible.

---

## F. Admin interface (Q23–Q26)

**Both interfaces from one backend:** put all admin operations in one set of Apps Script functions (an "admin API"). Expose them through (a) a **Sheets sidebar/dialog** (HtmlService) and (b) a **standalone web page**. The same HTML can be reused for both, so the two interfaces can't drift apart in functionality.

Other admin problems to plan for (Q24):
- Undoing a correction, with full history (append-only corrections).
- A "missing holes" matrix: team × hole completion (already in your notes).
- Outlier flags: score of 1 on a par 4, score above a cap, holes submitted out of order or impossibly fast.
- Two admins editing at once.
- Re-issuing a team's link/QR when a device is lost (ties to Q39).
- Renaming or merging teams; walk-up teams added on game day.
- Tie-breakers and playoff entry.
- Freezing the leaderboard at a cutoff ("official results") and exporting results.
- A log of admin actions (who changed what, when).
- Batch corrections, e.g. pasted from a sheet (in your notes); OCR of paper cards is a stretch goal.

---

## G. Where course/event config should live (Q27, Q28)

| Option | Pros | Cons |
|---|---|---|
| Hard-coded in code (today) | Simple | Needs a code change and redeploy per event; frontend and backend drift |
| JSON file per event in the repo | Versioned, reviewable, testable | Non-technical admins can't edit; still needs a deploy |
| **Config tabs in the event's Google Sheet** | Admins edit it themselves; one source for frontend and backend | Needs validation (bad edits break the event); quota per fetch |
| Script Properties | Good for secrets/small settings | Not suited to tables; not admin-friendly |
| External API at runtime | Always current | Free-tier limits, outages on course, ToS risk |

**Recommendation:** use Sheet tabs (`Event`, `Course`, `Teams`, `Vendors`, `Branding`) as the source of truth, validated by a **"Validate config"** admin menu item. The frontend fetches the config once at startup through the proxy and caches it in `localStorage` for offline play. An *importer* (section H) can pre-fill the Course tab. A JSON schema plus sample config lives in the repo for tests and docs.

---

## H. Course data and maps (Q29, Q30)

Research summary:
- **OpenStreetMap:** this is the best free option for disc golf. It has tagging for holes (`disc_golf=hole` with `ref` and `par`), tees (`disc_golf=tee`), baskets (`disc_golf=basket`) and course relations ([OSM wiki](https://wiki.openstreetmap.org/wiki/Tag%3Aleisure%3Ddisc_golf_course)). You can query it free through the Overpass API. Distances must be computed from geometry. Coverage varies, but you can **add Brackett's Bluff to OSM yourselves**. Data is ODbL, so attribution is required.
- **UDisc:** no public API found. Layout pages show distance and par ([UDisc blog](https://udisc.com/blog/post/udisc-update-course-pars-and-hole-names)), but scraping likely violates its terms. Worth asking UDisc directly about a partnership.
- **PDGA:** no documented course-layout API; player pages show layout totals only.
- **Ball golf:** [OpenGolfAPI](https://opencollective.com/golfapi) is a free, open, volunteer-run database of about 16,900 US courses with GPS and scorecards. It launched in 2026, so check how reliable and complete it is. Commercial options such as [Zyla's Golf Courses Data API](https://zylalabs.com/en/api-marketplace/data/golf+courses+data+api/2029) and [SportsFirst](https://www.sportsfirst.net/sportsapi/golf-course-api) exist; check whether they have a free tier.

**Building it yourselves:**
- An admin "course builder" page: tap tee and basket locations on a map (Leaflet), or walk the course and record the phone's GPS at each tee and basket.
- Save the result to the Course tab, and optionally contribute it back to OSM.

**Interactive "you are here" map:**
- The browser Geolocation API needs HTTPS (fine on Netlify) and a permission prompt. iOS may ask again, and accuracy under tree cover can be 10–30 m.
- **Offline is the main problem:** live map tiles won't load with spotty coverage. OSM's tile servers also restrict heavy use. A free-tier-friendly option is a **pre-rendered course image** (like `brackett_bluff_hole_background.jpg`) georeferenced with corner coordinates. The phone plots its GPS fix on the cached image with no network needed.
- Battery: use one-off position reads (e.g. on each hole submit) rather than continuous tracking.

---

## I. Registration (Q31–Q35)

**Ingestion techniques (they work for Wix and other platforms):**
1. **Webhook → proxy → Apps Script** (your preference, Q34). Wix Automations can send an HTTP request when a form is submitted; **confirm this is available on your free plan.**
2. **Polling:** a timed Apps Script trigger pulls new registrations from the platform's API. This avoids inbound webhooks but needs API keys and may need a paid plan.
3. **Export/import:** an admin uploads a CSV export. This works with any platform (Eventbrite, Google Forms, Tally) and is a reliable fallback.
4. **A generic, platform-neutral endpoint:** define *your* registration payload format. A small adapter per platform (Wix, Google Forms, Eventbrite) maps into it. This is what makes other organisations' setups work.

**Problems to expect:**
- **Apps Script `doPost` cannot read request headers.** It can't verify webhook signatures sent in headers (HMAC/JWT). That's another reason to route webhooks through the Netlify proxy, which can verify them and then forward with a shared secret.
- Apps Script web apps answer with a **302 redirect**; some webhook senders don't follow redirects. The proxy avoids this too.
- Duplicate or retried webhooks, so registrations need an idempotency key.
- Turning individual sign-ups into teams; late changes, cancellations and walk-ups.
- **Wix's built-in QR codes:** Wix Events ticket QRs encode Wix ticket identifiers for check-in, **not** your app URL. Two ways to tie them together: (a) map the Wix ticket/order ID to your player token at ingestion, and have players scan a QR *you* generate (emailed, or printed at check-in); or (b) at check-in, staff scan the Wix ticket QR in an admin page that hands out the scoring QR.
- Apps Script email quota on a consumer Google account is low (on the order of 100/day). Check this against attendee counts, or batch the sends.
- Storing PII in a Sheet: who has access, and when it gets deleted.

**Suggested registration fields (Q32):** name; email (for link delivery and device recovery); team name or partner; company; role/industry; interest tags (feeds matching, section L); opt-in checkboxes for **location use**, **sharing contact info with vendors** and **photos**; accessibility needs. Keep everything else optional, since every field adds friction.

**QR model options (Q33):**

| Model | Pros | Cons |
|---|---|---|
| One QR per team (today) | Simple, few prints | The "2 people per QR" confusion; no per-player identity for vendor matching |
| **One QR per player, linked to a team** | Each phone is its own identity; good for matching and recovery; either teammate can score | Needs a conflict rule when both teammates submit the same hole (section A rule applies) |
| Team QR + designated scorekeeper | No conflicts | Single point of failure if that phone dies |
| Emailed magic link + printed QR at check-in | Works with no printing beforehand; recovery by email | Depends on email deliverability and reception on course |

Recommendation: **one QR per player, linked to a team**. Deliver it both by email and on the printed check-in badge.

---

## J. Auth with no friction (Q36–Q39)

**Current weakness:** group tokens are team names (guessable) and are listed in the client HTML. Anyone who opens the page source can submit scores for any team.

**Proposed model:**
1. **Unguessable per-player tokens.** Each is at least 128 bits of randomness, or an HMAC-signed `{event, team, player, expiry}` built with a secret known only to the server. The QR contains this token, so scanning *is* logging in: zero extra steps.
2. **No token lists in the frontend.** The server validates tokens; the frontend only stores its own token.
3. **Netlify proxy in front of Apps Script.** It hides the Apps Script URL, adds rate limiting and payload size limits, and forwards with a shared secret that Apps Script checks. Apps Script rejects requests that don't carry it. Watch the Netlify free-tier function limits.
4. **Device binding on first use.** The first scan registers a device key in `localStorage`. A leaked QR photo used on another device gets flagged, and an admin can approve the transfer. Treat this as a soft check: flag for review rather than block, so legitimate device swaps aren't stopped.
5. **Offline (Q38).** The token is stored locally; queued submissions carry the token and an idempotency key; the server validates on sync. Expiry should be generous, e.g. end of event day.
6. **Recovery (Q39).** An admin re-issues a token, which revokes the old one, or the player re-opens the emailed link on the new device. The server returns that team's already-submitted holes so the new device can pick up where the old one left off.
7. **Revocation and expiry.** Tokens expire after the event; a revocation list lives in the Sheet.
8. **Admin auth (Q26 says the same method as players).** Admin actions are far more sensitive, so the same *mechanism* with stronger tokens is fine. A Google-account check (`Session.getActiveUser()` for the Sheets sidebar) is also nearly frictionless for admins.

**Attack vectors this covers:** guessing tokens; reading tokens from the page source; replaying captured requests (idempotency key + expiry); request flooding (proxy rate limits); formula/XSS injection (existing whitelists, kept and tested); scoring for a different team (per-team scoping of tokens).

---

## K. Vendor/user privacy (Q42)

- **Use opt-in consent at registration**, separately for location use and for sharing contact details with vendors. Don't make consent a condition of playing.
- **Vendors see only aggregates** (e.g. "12 groups passed your hole; 5 marked interest in X") unless a player explicitly says "share my contact with this vendor."
- **Minimise location data.** You only need "current hole", not raw GPS. Convert GPS to a hole on the device, and send only the hole number.
- Set retention: delete location and match data after the event, and keep only aggregate ROI numbers.
- Publish a short privacy notice linked from the registration and the app.
- Check the privacy laws that apply to your attendees, e.g. US state laws, and GDPR if any attendees are from the EU. Ask the host organisation whether they already have a policy to extend.
- Sponsor contracts may already promise something about lead sharing. Make sure the app's behaviour matches those promises.

---

## L. Matching algorithm options (Q43)

1. **v1: rules.** Recommend a vendor when (a) the player's interest tags overlap the vendor's tags **and** (b) the vendor's hole is within the group's next N holes. You get position from the last submitted hole plus the start hole (no GPS needed), and GPS can refine it.
2. **v2: weighted score.** Score = interest overlap × proximity × not-yet-visited × vendor rotation fairness. Fairness is needed so every sponsor gets exposure, which may be a contractual obligation.
3. **v3: learning from feedback.** Record outcomes: notification shown, tapped, dismissed, "met this vendor" (e.g. scanning a vendor's QR at their hole). Use them to tune the weights. Across several events, simple collaborative filtering becomes possible.
- Cold start: v1 needs only registration tags and vendor tags, so it works at the first event.
- Notification fatigue: cap at e.g. one recommendation per 3 holes, so recommendations don't get in the way of scoring.
- In-app only (Q41): notifications appear on the next screen load or after a submission. No push service is needed, so it stays free-tier and works offline.

---

## M. Sponsor ROI metrics (Q44)

| Metric | How | Issues |
|---|---|---|
| Logo impressions | `IntersectionObserver`, counted locally | Each beacon costs a request (free-tier); **batch counts onto score submissions** |
| Logo time on screen | Same, accumulated per vendor | Inflated by idle screens |
| Clicks / taps on vendor content | Event counter | Low volumes; easy to game |
| Recommendations shown / accepted | Matching log | Depends on matching volume |
| Verified visits | Player scans a vendor QR at their hole | Most meaningful; adds a step (optional, gamify it?) |
| Leads with consent | "Share my contact" taps | Privacy handling (section K) |
| Post-event survey | Form link at the end screen | Low response rates |

General issues:
- Content blockers (DuckDuckGo's included) may block anything that looks like tracking. Keep analytics first-party and in the same request as scores.
- Avoid vanity metrics. Agree with sponsors up front on which 2–3 numbers count.
- Offline: count locally and sync later.

---

## N. Still open

- **Q7 (resolved): multiple events at the same time.** This changes section G. Every record (scores, teams, tokens, config, corrections) needs an `eventId`, and tokens must be scoped to one event. The open choice is how to separate events:
  - **One spreadsheet per event**, with the backend routing by `eventId` through a registry of spreadsheet IDs. This gives strong isolation between organisers and keeps each sheet small for admins, but means more setup per event.
  - **One shared spreadsheet** with an `eventId` column. It's simpler, but any admin with access sees every event, and it grows quickly.

  Recommendation: one spreadsheet per event plus a central registry. Per-organiser data isolation is the safer default.
- **Q5 (resolved): two separate Apps Script projects.** The backend and leaderboard each get their own `clasp` folder and `.clasp.json`, plus their own deploy step in CI. The duplicate `doGet` issue doesn't apply. The top-level `getLeaderboardData()` call still runs on every leaderboard execution, which is wasteful but harmless.
- **Q14:** confirm the "first to reach the server wins, with admin overrides appended" rule (section A).
- **Q19/Q20 (done)** on branch `chore/remove-airtable-proxy-gitignore`. The old Airtable token is still in git history, so revoking it at Airtable is still recommended.
- **The cert file (Q12):** `tests/cert.crt` + `tests/key.pem` sit next to `tests/test_https_server.py`, so they were most likely a self-signed pair for testing the app over HTTPS locally (e.g. testing Geolocation or the phone camera on a LAN). They're safe to delete if that script is no longer used. Either way, they should be git-ignored.

---

## O. Decision log (2026-11-20)

These override the recommendations above where they differ.

| Topic | Decision |
|---|---|
| Project layout (Q5) | Backend and leaderboard are **two separate Apps Script projects** |
| Concurrency (Q7) | **Multiple events at the same time** |
| Resubmissions (§A) | **First submission to reach the server** counts; admin corrections are **appended override records** (never in-place); resubmissions flagged for review |
| Event storage (§N) | **One Google Sheet per event** + central registry of event → sheet ID |
| QR model (§I) | **One QR per player, linked to a team** |
| Invalid input (§C #13) | **Reject** with a field-level error to the player **and** log the rejected payload to a review tab |
| Proxy (§J) | **All traffic** (scores, config, webhooks) goes through the Netlify proxy |
| Repo visibility (§E) | **Public**, so CI uses CodeQL + GitHub secret scanning/push protection + Dependabot + gitleaks |
| Environments (§E) | **Staging first**: merges deploy to staging; production deploy needs manual approval |
| Config editing (§G) | **Admin web form** (not hand-edited Sheet tabs), saving to **protected hidden tabs in each event's Sheet** |
| Map (§H) | **Cached georeferenced course image first**, live tiles later |
| Location (§H, §L) | **Last submitted hole as baseline; GPS refines on opt-in**; only the inferred hole is sent to the server |
| Admin auth (§J) | **Signed token + approved Google account** |
| Data retention (§K) | **Keep personal data until next year's event.** Consent wording must say so explicitly |
| ROI metrics (§M) | All four: **logo impressions, recommendations shown/accepted, verified vendor visits (QR at vendor hole), opt-in leads** |
| Unit tests (§D) | **Jest** |

### Revised phase order (replaces §B)

0. Foundation (clasp per project, docs, gitignore): partly done
1. Tests (Jest) + CI (CodeQL, secret scanning, gitleaks, Dependabot, ESLint) + staging/production deploys
2. Correctness (resubmission rule, appended corrections, reject-and-log validation, failure modes in §C)
3. **Auth** (signed per-player tokens, all traffic through the proxy, admin = token + Google account). Moved ahead of config. It needs at least a minimal `eventId` so tokens can be scoped per event.
4. **Event/course config** via the admin web form, sheet per event + registry
5. Registration (Wix webhook → proxy → Apps Script; per-player QR)
6. Rest of the admin interface (corrections, missing-holes matrix, outlier flags, etc.)
7. Vendor matchup + ROI metrics

### Still open

- **The public repo exposes things today:** group tokens and the Apps Script URL in `index.html` are readable by anyone on GitHub until phase 3 lands. Consider redeploying the Apps Script web app under a new URL once the proxy exists.
- **ROI metrics and free-tier limits:** collecting all four metrics needs to be checked against Netlify function and Apps Script quotas. This depends on batching counts onto score submissions.
- **Keeping data until next year:** this needs a privacy notice and an annual deletion step (who runs it, and when).
