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
