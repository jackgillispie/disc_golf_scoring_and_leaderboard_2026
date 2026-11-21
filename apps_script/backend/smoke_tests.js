// ============================================================
// SMOKE TESTS — run against the real Apps Script services.
//
// Staging only: refuses to run unless Script Property ENVIRONMENT=staging.
// Run from the staging backend project's editor: select `runSmokeTests`,
// click Run, then read the execution log. Test rows are tagged with a
// unique Tournament marker and removed afterwards.
//
// Pure logic is covered by Jest (tests/unit); these checks cover what
// Jest can't: real Sheets I/O, doPost/doGet wiring and permissions.
// ============================================================

function runSmokeTests() {
  if (getEnvironmentName() !== 'staging') {
    throw new Error('Smoke tests only run in staging (set Script Property ENVIRONMENT=staging).');
  }

  const ss = getEventSpreadsheet();
  ensureSheets(ss);
  const raw = ss.getSheetByName(SHEET_SCORES);
  const marker = 'SMOKE ' + Date.now(); // allowed by the Tournament allow-list
  const results = [];

  const check = (name, fn) => {
    try {
      fn();
      results.push('PASS  ' + name);
    } catch (err) {
      results.push('FAIL  ' + name + ': ' + err.message);
    }
  };
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
  const post = (payload) => JSON.parse(
    doPost({ postData: { contents: JSON.stringify(payload) } }).getContent()
  );
  const markerRows = () => raw.getDataRange().getValues().slice(1).filter(r => r[1] === marker);
  const submission = (overrides) => Object.assign({
    Tournament: marker, Group: '99Z', Token: VALID_TOKENS[1], Players: 'Smoke Test',
    Hole: 1, Par: 3, Dist: 276, Score: 3, VsPar: 0, Timestamp: new Date().toISOString(),
  }, overrides);

  try {
    check('doGet health check responds', () => {
      const res = JSON.parse(doGet().getContent());
      assert(res.status === 'alive', 'status was ' + res.status);
    });

    check('ensureSheets creates all sheets', () => {
      [SHEET_SCORES, SHEET_LEADERBOARD, SHEET_HOLES, SHEET_GROUPS].forEach(name =>
        assert(ss.getSheetByName(name), 'missing sheet ' + name));
    });

    check('doPost with a valid token appends one row', () => {
      const res = post(submission({}));
      assert(res.status === 'ok', 'response: ' + JSON.stringify(res));
      assert(markerRows().length === 1, 'expected 1 row, found ' + markerRows().length);
    });

    check('doPost with an invalid token is rejected and writes nothing', () => {
      const before = markerRows().length;
      const res = post(submission({ Token: 'Not A Team' }));
      assert(res.status === 'error', 'response: ' + JSON.stringify(res));
      assert(markerRows().length === before, 'a row was written');
    });

    check('doPost stores a script-injection Players value as blank', () => {
      post(submission({ Hole: 2, Players: '<img src=x onerror=alert(1)>' }));
      const row = markerRows().find(r => Number(r[4]) === 2);
      assert(row, 'row for hole 2 not found');
      assert(row[3] === '', 'Players stored as ' + JSON.stringify(row[3]));
    });

    check('rebuildLeaderboard lists the smoke-test group', () => {
      rebuildLeaderboard(ss);
      const groups = ss.getSheetByName(SHEET_LEADERBOARD).getDataRange().getValues().slice(1).map(r => r[1]);
      assert(groups.includes('99Z'), 'group 99Z not on leaderboard');
    });
  } finally {
    // Remove test rows (bottom-up so indexes stay valid) and rebuild.
    const values = raw.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i][1] === marker) raw.deleteRow(i + 1);
    }
    rebuildLeaderboard(ss);
    rebuildHoleSummary(ss);
  }

  console.log(results.join('\n'));
  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length) {
    throw new Error(failed.length + ' smoke test(s) failed:\n' + failed.join('\n'));
  }
  return results;
}
