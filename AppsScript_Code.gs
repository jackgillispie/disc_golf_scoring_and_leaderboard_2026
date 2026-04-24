// ============================================================
// Brackett's Bluff — Live Tournament Scoring Backend
// Google Apps Script — deploy as Web App
//
// SETUP:
// 1. script.google.com → New Project → paste this file
// 2. Deploy → New Deployment → Web App
//    Execute as: Me | Who has access: Anyone
// 3. Copy deployment URL → paste into bracketts_bluff_scorer.html
// ============================================================

const SHEET_SCORES      = 'Raw Scores';
const SHEET_LEADERBOARD = 'Leaderboard';
const SHEET_HOLES       = 'Hole Summary';
const SHEET_GROUPS      = 'Group Tokens';

// Valid tokens — must match GROUP_TOKENS in the HTML file
const VALID_TOKENS = [
  'card01-a3x9','card02-b7k2','card03-c4m8','card04-d1p5','card05-e6r3',
  'card06-f9s7','card07-g2t1','card08-h5u4','card09-j8v6','card10-k3w9',
  'card11-l7x2','card12-m1y5','card13-n4z8','card14-p6a3','card15-q9b7',
  'card16-r2c1','card17-s5d4','card18-t8e6'
];

// ============================================================
// ENTRY POINT — POST from scorecard app
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Token validation — reject submissions without valid token
    if (!data.token || !VALID_TOKENS.includes(data.token)) {
      return respond({ status: 'error', message: 'Invalid group token' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);
    writeScore(ss, data);
    rebuildLeaderboard(ss);
    rebuildHoleSummary(ss);

    return respond({ status: 'ok', hole: data.hole, group: data.group });

  } catch(err) {
    return respond({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  return respond({ status: 'alive', time: new Date().toISOString() });
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ENSURE SHEETS EXIST
// ============================================================
function ensureSheets(ss) {
  setupSheet(ss, SHEET_SCORES, [
    'Timestamp','Tournament','Group','Players','Hole','Par','Dist (ft)','Score','vs Par','Token'
  ], '#1a2e1a', '#8bc34a');

  setupSheet(ss, SHEET_LEADERBOARD, [
    'Place','Group','Players','Total Strokes','vs Par','Holes Played','Last Updated'
  ], '#1a2e1a', '#8bc34a');

  setupSheet(ss, SHEET_HOLES, [
    'Hole','Par','Dist (ft)','Submissions','Avg Score','Best Score','Eagles/Birdies'
  ], '#1a2e1a', '#8bc34a');

  setupSheet(ss, SHEET_GROUPS, [
    'Token','Group','URL','Status'
  ], '#1a2e1a', '#8bc34a');
}

function setupSheet(ss, name, headers, bgColor, fgColor) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setBackground(bgColor).setFontColor(fgColor).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============================================================
// WRITE SCORE — deduplicate by group + hole
// ============================================================
function writeScore(ss, data) {
  const sheet = ss.getSheetByName(SHEET_SCORES);

  // Delete any existing entry for this group + hole
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][2]) === String(data.group) &&
        Number(rows[i][4]) === Number(data.hole)) {
      sheet.deleteRow(i + 1);
    }
  }

  // Append new score
  sheet.appendRow([
    new Date(data.timestamp),
    data.tournament,
    data.group,
    data.players,
    data.hole,
    data.par,
    data.dist,
    data.score,
    data.vsPar,
    data.token
  ]);

  colorVsParColumn(sheet);
}

// ============================================================
// REBUILD LEADERBOARD
// ============================================================
function rebuildLeaderboard(ss) {
  const raw = ss.getSheetByName(SHEET_SCORES);
  const lb  = ss.getSheetByName(SHEET_LEADERBOARD);

  const rows = raw.getDataRange().getValues().slice(1);

  // Aggregate by group
  const groups = {};
  rows.forEach(row => {
    const group   = String(row[2]);
    const players = String(row[3]);
    const par     = Number(row[5]);
    const score   = Number(row[7]);
    const hole    = Number(row[4]);

    if (!groups[group]) {
      groups[group] = { group, players, totalScore: 0, totalPar: 0, holes: new Set() };
    }
    if (!groups[group].holes.has(hole)) {
      groups[group].holes.add(hole);
      groups[group].totalScore += score;
      groups[group].totalPar   += par;
      // Keep latest players string
      groups[group].players = players;
    }
  });

  const sorted = Object.values(groups)
    .sort((a, b) => (a.totalScore - a.totalPar) - (b.totalScore - b.totalPar));

  // Clear old data
  if (lb.getLastRow() > 1) {
    lb.getRange(2, 1, lb.getLastRow() - 1, 7).clearContent().clearFormat();
  }

  const now = new Date().toLocaleTimeString();

  sorted.forEach((g, i) => {
    const diff    = g.totalScore - g.totalPar;
    const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
    lb.appendRow([
      i + 1, g.group, g.players, g.totalScore, diffStr, g.holes.size, i === 0 ? now : ''
    ]);

    // Color formatting
    const placeCell = lb.getRange(i + 2, 1);
    const vsParCell = lb.getRange(i + 2, 5);

    if (i === 0) lb.getRange(i + 2, 1, 1, 7).setBackground('#fff8e1');

    if (diff < 0)      vsParCell.setFontColor('#2e7d32').setFontWeight('bold');
    else if (diff > 0) vsParCell.setFontColor('#e65100').setFontWeight('bold');
    else               vsParCell.setFontColor('#424242');
  });

  // Update timestamp in header
  lb.getRange(1, 7).setValue('Last updated: ' + now);
}

// ============================================================
// REBUILD HOLE SUMMARY
// ============================================================
function rebuildHoleSummary(ss) {
  const raw = ss.getSheetByName(SHEET_SCORES);
  const hs  = ss.getSheetByName(SHEET_HOLES);

  const rows = raw.getDataRange().getValues().slice(1);

  const HOLES = [
    {n:1,dist:276,par:3},{n:2,dist:181,par:3},{n:3,dist:383,par:4},
    {n:4,dist:252,par:3},{n:5,dist:268,par:3},{n:6,dist:246,par:3},
    {n:7,dist:298,par:3},{n:8,dist:357,par:3},{n:9,dist:333,par:3},
    {n:10,dist:274,par:3},{n:11,dist:125,par:3},{n:12,dist:223,par:3},
    {n:13,dist:208,par:3},{n:14,dist:202,par:3},{n:15,dist:239,par:3},
    {n:16,dist:279,par:3},{n:17,dist:181,par:3},{n:18,dist:242,par:3}
  ];

  if (hs.getLastRow() > 1) {
    hs.getRange(2, 1, hs.getLastRow() - 1, 7).clearContent();
  }

  HOLES.forEach(h => {
    const scores = rows
      .filter(r => Number(r[4]) === h.n)
      .map(r => Number(r[7]));

    if (scores.length === 0) {
      hs.appendRow([h.n, h.par, h.dist, 0, '—', '—', 0]);
      return;
    }

    const avg     = scores.reduce((a,b)=>a+b,0) / scores.length;
    const best    = Math.min(...scores);
    const birdies = scores.filter(s => s <= h.par - 1).length;

    hs.appendRow([
      h.n, h.par, h.dist, scores.length,
      Math.round(avg * 10) / 10,
      best,
      birdies
    ]);
  });
}

// ============================================================
// COLOR vs PAR COLUMN (col 9 = index 8)
// ============================================================
function colorVsParColumn(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  for (let i = 2; i <= lastRow; i++) {
    const v    = Number(sheet.getRange(i, 9).getValue());
    const cell = sheet.getRange(i, 9);
    if (v < 0)      cell.setFontColor('#2e7d32').setFontWeight('bold');
    else if (v > 0) cell.setFontColor('#e65100').setFontWeight('normal');
    else            cell.setFontColor('#424242').setFontWeight('normal');
  }
}

// ============================================================
// POPULATE GROUP TOKENS SHEET
// TD runs this once to generate the URL reference sheet
// ============================================================

//TODO Add QR function somewhere in here

function populateGroupTokens() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);
  const sheet = ss.getSheetByName(SHEET_GROUPS);

  // Clear existing data rows
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
  }

  // Get the deployed web app URL — replace with yours after deployment
  const BASE_URL = 'lknitpdiscgolf.netlify.app';

  const tokens = [
    {token:'card01-a3x9', group:'Card 1'},
    {token:'card02-b7k2', group:'Card 2'},
    {token:'card03-c4m8', group:'Card 3'},
    {token:'card04-d1p5', group:'Card 4'},
    {token:'card05-e6r3', group:'Card 5'},
    {token:'card06-f9s7', group:'Card 6'},
    {token:'card07-g2t1', group:'Card 7'},
    {token:'card08-h5u4', group:'Card 8'},
    {token:'card09-j8v6', group:'Card 9'},
    {token:'card10-k3w9', group:'Card 10'},
    {token:'card11-l7x2', group:'Card 11'},
    {token:'card12-m1y5', group:'Card 12'},
    {token:'card13-n4z8', group:'Card 13'},
    {token:'card14-p6a3', group:'Card 14'},
    {token:'card15-q9b7', group:'Card 15'},
    {token:'card16-r2c1', group:'Card 16'},
    {token:'card17-s5d4', group:'Card 17'},
    {token:'card18-t8e6', group:'Card 18'},
  ];

  tokens.forEach(t => {
    sheet.appendRow([
      t.token,
      t.group,
      BASE_URL + '?g=' + t.token,
      'Active'
    ]);
  });

  SpreadsheetApp.getUi().alert(
    'Group URLs generated!\n\n' +
    'Check the "Group Tokens" tab for all 18 scoring URLs.\n' +
    'Text or QR-code the URL in column C to each group captain.'
  );
}

// ============================================================
// MANUAL RECALCULATE — TD runs from Apps Script menu
// ============================================================
function recalculateLeaderboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  rebuildLeaderboard(ss);
  rebuildHoleSummary(ss);
  SpreadsheetApp.getUi().alert('Leaderboard recalculated successfully.');
}

// ============================================================
// CORRECT A SCORE — TD runs interactively
// ============================================================
function correctScore() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const groupResp = ui.prompt('Correct a Score', 'Enter the Group name (e.g. Card 3):', ui.ButtonSet.OK_CANCEL);
  if (groupResp.getSelectedButton() !== ui.Button.OK) return;

  const holeResp = ui.prompt('Correct a Score', 'Enter the Hole number (1-18):', ui.ButtonSet.OK_CANCEL);
  if (holeResp.getSelectedButton() !== ui.Button.OK) return;

  const scoreResp = ui.prompt('Correct a Score', 'Enter the correct score:', ui.ButtonSet.OK_CANCEL);
  if (scoreResp.getSelectedButton() !== ui.Button.OK) return;

  const group    = groupResp.getResponseText().trim();
  const hole     = Number(holeResp.getResponseText().trim());
  const newScore = Number(scoreResp.getResponseText().trim());

  const sheet = ss.getSheetByName(SHEET_SCORES);
  const rows  = sheet.getDataRange().getValues();
  let found   = false;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2]) === group && Number(rows[i][4]) === hole) {
      const par = Number(rows[i][5]);
      sheet.getRange(i + 1, 8).setValue(newScore);        // Score
      sheet.getRange(i + 1, 9).setValue(newScore - par);  // vs Par
      found = true;
      break;
    }
  }

  if (found) {
    colorVsParColumn(sheet);
    rebuildLeaderboard(ss);
    rebuildHoleSummary(ss);
    ui.alert('Score corrected and leaderboard updated.');
  } else {
    ui.alert('No score found for ' + group + ' Hole ' + hole + '. Check the group name and hole number.');
  }
}

// ============================================================
// ADD CUSTOM MENU TO SPREADSHEET
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TD Tools')
    .addItem('Initialize sheets', 'initializeSheets')
    .addItem('Generate group URLs', 'populateGroupTokens')
    .addSeparator()
    .addItem('Recalculate leaderboard', 'recalculateLeaderboard')
    .addItem('Correct a score', 'correctScore')
    .addToUi();
}

function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);
  SpreadsheetApp.getUi().alert('Sheets initialized. Ready for scoring.');
}
