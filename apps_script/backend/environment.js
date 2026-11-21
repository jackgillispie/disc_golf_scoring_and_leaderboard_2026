// ============================================================
// ENVIRONMENT — which spreadsheet this project reads/writes.
//
// KEEP IN SYNC: an identical copy lives in apps_script/leaderboard/.
// (Separate Apps Script projects can't share files; a unit test
// fails if the two copies differ.)
//
// Standalone projects (staging + production) are pointed at their
// spreadsheet with the Script Property SPREADSHEET_ID
// (Project Settings → Script Properties; see docs/deployment.md).
// A script bound to a spreadsheet falls back to that spreadsheet.
// Phase 4 replaces this with the per-event registry.
// ============================================================

function getEventSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('No spreadsheet configured: set the Script Property SPREADSHEET_ID');
  }
  return active;
}

// 'staging', 'production', or 'unset'. Used to guard staging-only tools.
function getEnvironmentName() {
  return PropertiesService.getScriptProperties().getProperty('ENVIRONMENT') || 'unset';
}

// Address of the player scoring app (Netlify) for this environment, from
// the Script Property APP_BASE_URL, e.g. "lknitpdiscgolf2026.netlify.app".
// Returned without scheme or trailing slash: callers add "?g=<token>", and
// the QR formula adds "https://". No default, so a staging project can
// never quietly hand out production links.
function getAppBaseUrl() {
  const raw = PropertiesService.getScriptProperties().getProperty('APP_BASE_URL');
  const url = String(raw || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!url) {
    throw new Error('No scoring app address configured: set the Script Property APP_BASE_URL');
  }
  return url;
}