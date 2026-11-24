// ============================================================
// Brackett's Bluff — Live Tournament Scoring Backend
// Google Apps Script — deploy as Web App
//
// SETUP:
// 1. script.google.com → New Project → paste this file
// 2. Deploy → New Deployment → Web App
//    Execute as: Me | Who has access: Anyone
// 3. Copy deployment URL → paste into bracketts_bluff_scorer.html
//
//5.4 Pulling out rebuildLeaderboard and rebuildHoleSummary
// to improve speed on POST
// POST should recieve data and write it to file only
// ============================================================

const SHEET_SCORES      = 'Raw Scores';
const SHEET_LEADERBOARD = 'Leaderboard';
const SHEET_HOLES       = 'Hole Summary';
const SHEET_GROUPS      = 'Group Tokens';

// Brackett's Bluff layout (hole number, distance in ft, par).
// Moves to per-event config in phase 4.
const COURSE_HOLES = [
  {n:1,dist:276,par:3},{n:2,dist:181,par:3},{n:3,dist:383,par:4},
  {n:4,dist:252,par:3},{n:5,dist:268,par:3},{n:6,dist:246,par:3},
  {n:7,dist:298,par:3},{n:8,dist:357,par:3},{n:9,dist:333,par:3},
  {n:10,dist:274,par:3},{n:11,dist:125,par:3},{n:12,dist:223,par:3},
  {n:13,dist:208,par:3},{n:14,dist:202,par:3},{n:15,dist:239,par:3},
  {n:16,dist:279,par:3},{n:17,dist:181,par:3},{n:18,dist:242,par:3}
];

// 5.16 testing if no spaces works on DuckDuckGo
// Valid tokens — must match GROUP_TOKENS in the HTML file
const VALID_TOKENS = ['Aceless-Briars', 'Anhyzer-Anvils', 'Ankle-Biters-Anonymous', 'Bark-Biters', 'Basket-Boggarts', 'Basket-Breakers', 'Basket-Breakers', 'Basket-Hanging-Hoodlums', 'Birdie-Bandits', 'Bonsai-Brigade', 'Bramble-Boys', 'Caddy-Cap-Crusaders', 'Chain-Bangers', 'Chain-Bang-Chums', 'Cobblestone-Kings', 'Compact-Commandos', 'Dahlia-Drivers', 'Double-Grip-Dwarves', 'Fairway-Faeries', 'Fairway-Felons', 'Fiends-of-Fairway', 'Foxglove-Flickers', 'Fun-Sized-Force', 'Garden-Gate-Gliders', 'Gnomish-Gentry', 'Granite-Gliders', 'Grass-Top-Gliders', 'Gravel-Pit-Putters', 'Grip-Lock-Goblins', 'Ground-Level-Grifters', 'Half-Pint-Phantoms', 'High-Speed-Hobgoblins', 'Inch-High-Imps', 'Knee-High-Knockouts', 'Knee-High-Knucklers', 'Leaf-Litter-Legion', 'Little-League-Legends', 'Loft-Shot-Lads', 'Low-Profile-Pros', 'Micro-Stature-Marauders', 'Miniature-Mountain-Men', 'Mithril-Midrangers', 'Mossy-Midrangers', 'Mound-Bound-Marauders', 'Mycelium-Marauders', 'Noggin-Gnomes', 'Overstable-Ogres', 'Pebble-Pushers', 'Petite-Power-Players', 'Petunia-Putters', 'Picket-Fence-Putters', 'Pint-Sized-Putters', 'Pipe-Puffers', 'Pocket-Sized-Putters', 'Porch-Sitters', 'Putter-Prowlers', 'Putter-Pocket-Pranksters', 'Rose-Thorn-Rollers', 'Scramble-Scoundrels', 'Shadow-Shortened-Scoundrels', 'Shank-Shifters', 'Shin-Height-Shufflers', 'Short-Range-Sharpshooters', 'Slightly-Small-Saboteurs', 'Small-Batch-Boys', 'Speckled-Spores', 'Spore-Sprouts', 'Stump-Hitters', 'Tee-Box-Terrors', 'Teeny-Tiny-Titans', 'The-Ace-Runners', 'The-Chains-Chasers', 'The-Grass-Stain-Gang', 'The-Low-Down-Dirty-Dogs', 'The-Minuscule-Misfits', 'The-Plastic-Heavyweights', 'The-Roller-Rebels', 'The-Thicket-Throwers', 'Tomahawk-Trolls', 'Trellis-Tossers', 'Turbo-Putt-Trolls', 'Turnover-Trowels', 'Verticality-Challenged', 'Wee-Folk-Warriors', 'Wheelbarrow-Wingers', 'Windy-Wizards', ];

// ============================================================
// ENTRY POINT — POST from scorecard app
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Token validation — reject submissions without valid token
    if (!isValidToken(data.Token)) {
      return respond({ status: 'error', message: 'Invalid group token' });
    }

    const ss = getEventSpreadsheet();
    ensureSheets(ss);
    writeScore(ss, data);

    //5.4 pulling these out, will put them in a timer or something similar
    // rebuildLeaderboard(ss);
    // rebuildHoleSummary(ss);

    // to send on the frontend, recommended to wrap the getResponseText
    // in ContentService.createTextOutput(JSON...

    return ContentService.createTextOutput(
    JSON.stringify({status: "ok", "message": `Score for hole ${data.Hole} recorded`}))
    .setMimeType(ContentService.MimeType.JSON);

    // return respond({ status: 'ok', hole: data.hole, group: data.group });

  } catch(err) {

    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
    .setMimeType(ContentService.MimeType.JSON)

    // return respond({ status: 'error', message: err.toString() });
  }
}

function doGet() {
  return respond({ status: 'alive', time: new Date().toISOString() });
}

// ============================================================
// PURE HELPERS — no Apps Script services; unit-tested with Jest
// (see tests/unit). Keep Sheets/Content calls out of these.
// ============================================================

// True when the token is present and on the allow-list.
function isValidToken(token) {
  return Boolean(token) && VALID_TOKENS.includes(token);
}

// Allow-list each submitted field (mitigates leaderboard XSS and
// formula injection in Sheets). Invalid fields become null.
// Token is passed through: it is checked by isValidToken() first.
function sanitizeSubmission(data) {
  return {
    "Tournament": /^[A-Za-z0-9 ]+$/.test(data.Tournament) ? data.Tournament : null, // only A-Z 0-9 whitespace
    "Group": /^[0-9]+[A-Z]$/.test(data.Group) ? data.Group : null, // "1A"
    "Token": data.Token, // verified earlier, e.g. "Anhyzer Anvils"
    "Players": /^[A-Za-z0-9 &]+$/.test(data.Players) ? data.Players : null, // whitespace, alphanumerics, &
    "Hole": /^\d+$/.test(data.Hole) ? data.Hole : null, // 1
    "Par": /^\d+$/.test(data.Par) ? data.Par : null, // 3
    "Dist": /^\d+$/.test(data.Dist) ? data.Dist : null, // 276
    "Score": /^\d+$/.test(data.Score) ? data.Score : null, // 3
    "VsPar": /^[0-9-]+$/.test(data.VsPar) ? data.VsPar : null, // 0
    "Timestamp": !isNaN(Date.parse(data.Timestamp)) ? data.Timestamp : null // "2026-05-14T20:37:52.641Z"
  };
}

// Row layout for the Raw Scores sheet (matches ensureSheets headers).
// receivedAt is when the server got it, not when the phone sent it.
function buildScoreRow(clean, receivedAt) {
  return [
    receivedAt,
    clean.Tournament,
    clean.Group,
    clean.Players,
    clean.Hole,
    clean.Par,
    clean.Dist,
    clean.Score,
    clean.VsPar,
    clean.Token
  ];
}

// "E" for even, "+n" over par, "-n" under par.
function formatVsPar(diff) {
  return diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
}

// Aggregate Raw Scores rows (header removed) into ranked groups.
// Only the FIRST row per group + hole counts (sheet order = server
// arrival order); later resubmissions are ignored.
function aggregateLeaderboard(rows) {
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

  return Object.values(groups)
    .sort((a, b) => (a.totalScore - a.totalPar) - (b.totalScore - b.totalPar))
    .map(g => ({
      group: g.group,
      players: g.players,
      totalScore: g.totalScore,
      totalPar: g.totalPar,
      diff: g.totalScore - g.totalPar,
      holesPlayed: g.holes.size
    }));
}

// Per-hole statistics rows for the Hole Summary sheet.
// Note: counts EVERY submission, including resubmissions.
function summarizeHoles(rows, holes) {
  return holes.map(h => {
    const scores = rows
      .filter(r => Number(r[4]) === h.n)
      .map(r => Number(r[7]));

    if (scores.length === 0) {
      return [h.n, h.par, h.dist, 0, '—', '—', 0];
    }

    const avg     = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best    = Math.min(...scores);
    const birdies = scores.filter(s => s <= h.par - 1).length;

    return [
      h.n, h.par, h.dist, scores.length,
      Math.round(avg * 10) / 10,
      best,
      birdies
    ];
  });
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
// WRITE SCORE — appends every submission (nothing is deleted)
// The old mockFunction() XSS payloads now live in tests/unit.
// ============================================================

function writeScore(ss, data) {

  //
    const sheet = ss.getSheetByName(SHEET_SCORES);

  // Delete any existing entry for this group + hole
  // 5.4 Thinking data.group needs to be data.Groups to have deleting effect

    // this deletion operation, even nonfunction, may be slowing things down?
  /*
  const rows = sheet.getDataRange().getValues();

  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][2]) === String(data.group) &&
        Number(rows[i][4]) === Number(data.hole)) {
      sheet.deleteRow(i + 1);
    }
  }
  */

  // Allow-list every field (token was matched before we get here),
  // then append. Timestamp = when it hits the server.
  sheet.appendRow(buildScoreRow(sanitizeSubmission(data), new Date().toISOString()));

  // colorVsParColumn(sheet);
}

// ============================================================
// REBUILD LEADERBOARD
// ============================================================
//
// 5.4 appears to change players names for team ONLY when a new hole is pushed
// hole score does not seem to get updated here
// effectively changing players midway breaks intended purpose
// only if a hole submission is for a unique hole does it affect the ranking calculation
// need a way to resubmit the same hole and update the results
//
function rebuildLeaderboard(ss) {
  const raw = ss.getSheetByName(SHEET_SCORES);
  const lb  = ss.getSheetByName(SHEET_LEADERBOARD);

  const rows = raw.getDataRange().getValues().slice(1);
  const sorted = aggregateLeaderboard(rows);

  // Clear old data
  if (lb.getLastRow() > 1) {
    lb.getRange(2, 1, lb.getLastRow() - 1, 7).clearContent().clearFormat();
  }

  const now = new Date().toISOString();

  sorted.forEach((g, i) => {
    const diff = g.diff;
    lb.appendRow([
      i + 1, g.group, g.players, g.totalScore, formatVsPar(diff), g.holesPlayed, i === 0 ? now : ''
    ]);

    // Color formatting
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

  if (hs.getLastRow() > 1) {
    hs.getRange(2, 1, hs.getLastRow() - 1, 7).clearContent();
  }

  summarizeHoles(rows, COURSE_HOLES).forEach(row => hs.appendRow(row));
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
  const ss    = getEventSpreadsheet();
  ensureSheets(ss);
  const sheet = ss.getSheetByName(SHEET_GROUPS);

  // Clear existing data rows
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).clearContent();
  }

  // Scoring app address for this environment (Script Property APP_BASE_URL)
  const BASE_URL = getAppBaseUrl();
// 5.16 testing if no spaces works on DuckDuckGo

  const tokens = [{'token': 'Anhyzer-Anvils', 'group': '1A'}, {'token': 'Ankle-Biters-Anonymous', 'group': '1B'}, {'token': 'Bark-Biters', 'group': '1C'}, {'token': 'Basket-Boggarts', 'group': '1D'}, {'token': 'Basket-Breakers', 'group': '2A'}, {'token': 'Basket-Breakers', 'group': '2B'}, {'token': 'Basket-Hanging-Hoodlums', 'group': '2C'}, {'token': 'Birdie-Bandits', 'group': '2D'}, {'token': 'Bonsai-Brigade', 'group': '3A'}, {'token': 'Bramble-Boys', 'group': '3B'}, {'token': 'Caddy-Cap-Crusaders', 'group': '3C'}, {'token': 'Chain-Bang-Chums', 'group': '3D'}, {'token': 'Chain-Bangers', 'group': '4A'}, {'token': 'Cobblestone-Kings', 'group': '4B'}, {'token': 'Compact-Commandos', 'group': '4C'}, {'token': 'Dahlia-Drivers', 'group': '4D'}, {'token': 'Double-Grip-Dwarves', 'group': '5A'}, {'token': 'Fairway-Faeries', 'group': '5B'}, {'token': 'Fairway-Felons', 'group': '5C'}, {'token': 'Fiends-of-Fairway', 'group': '5D'}, {'token': 'Foxglove-Flickers', 'group': '6A'}, {'token': 'Fun-Sized-Force', 'group': '6B'}, {'token': 'Garden-Gate-Gliders', 'group': '6C'}, {'token': 'Gnomish-Gentry', 'group': '6D'}, {'token': 'Granite-Gliders', 'group': '7A'}, {'token': 'Grass-Top-Gliders', 'group': '7B'}, {'token': 'Gravel-Pit-Putters', 'group': '7C'}, {'token': 'Grip-Lock-Goblins', 'group': '7D'}, {'token': 'Ground-Level-Grifters', 'group': '8A'}, {'token': 'Half-Pint-Phantoms', 'group': '8B'}, {'token': 'High-Speed-Hobgoblins', 'group': '8C'}, {'token': 'Inch-High-Imps', 'group': '8D'}, {'token': 'Knee-High-Knockouts', 'group': '9A'}, {'token': 'Knee-High-Knucklers', 'group': '9B'}, {'token': 'Leaf-Litter-Legion', 'group': '9C'}, {'token': 'Little-League-Legends', 'group': '9D'}, {'token': 'Loft-Shot-Lads', 'group': '10A'}, {'token': 'Low-Profile-Pros', 'group': '10B'}, {'token': 'Micro-Stature-Marauders', 'group': '10C'}, {'token': 'Miniature-Mountain-Men', 'group': '10D'}, {'token': 'Mithril-Midrangers', 'group': '11A'}, {'token': 'Mossy-Midrangers', 'group': '11B'}, {'token': 'Mound-Bound-Marauders', 'group': '11C'}, {'token': 'Mycelium-Marauders', 'group': '11D'}, {'token': 'Noggin-Gnomes', 'group': '12A'}, {'token': 'Overstable-Ogres', 'group': '12B'}, {'token': 'Pebble-Pushers', 'group': '12C'}, {'token': 'Petite-Power-Players', 'group': '12D'}, {'token': 'Petunia-Putters', 'group': '13A'}, {'token': 'Picket-Fence-Putters', 'group': '13B'}, {'token': 'Pint-Sized-Putters', 'group': '13C'}, {'token': 'Pipe-Puffers', 'group': '13D'}, {'token': 'Pocket-Sized-Putters', 'group': '14A'}, {'token': 'Porch-Sitters', 'group': '14B'}, {'token': 'Putter-Pocket-Pranksters', 'group': '14C'}, {'token': 'Putter-Prowlers', 'group': '14D'}, {'token': 'Rose-Thorn-Rollers', 'group': '15A'}, {'token': 'Scramble-Scoundrels', 'group': '15B'}, {'token': 'Shadow-Shortened-Scoundrels', 'group': '15C'}, {'token': 'Shank-Shifters', 'group': '15D'}, {'token': 'Shin-Height-Shufflers', 'group': '16A'}, {'token': 'Short-Range-Sharpshooters', 'group': '16B'}, {'token': 'Slightly-Small-Saboteurs', 'group': '16C'}, {'token': 'Small-Batch-Boys', 'group': '16D'}, {'token': 'Speckled-Spores', 'group': '17A'}, {'token': 'Spore-Sprouts', 'group': '17B'}, {'token': 'Stump-Hitters', 'group': '17C'}, {'token': 'Tee-Box-Terrors', 'group': '17D'}, {'token': 'Teeny-Tiny-Titans', 'group': '18A'}, {'token': 'The-Ace-Runners', 'group': '18B'}, {'token': 'The-Chains-Chasers', 'group': '18C'}, {'token': 'The-Grass-Stain-Gang', 'group': '18D'}];

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
    `Check the "Group Tokens" tab for all ${tokens.length} scoring URLs.\n` +
    'Text or QR-code the URL in column C to each group captain.'
  );
}

function createQRCodes(){

// 5.13 TODO change token to array of dict structure
// change padded row to reference each items .token
//


 const ss = getEventSpreadsheet();
 const qrSheetHeaders = ["Col1", "Col2", "Col3"]
 setupSheet(ss, "QR Codes", qrSheetHeaders, '#1a2e1a', '#8bc34a' )
 const qr_sheet = ss.getSheetByName("QR Codes")


/*
const url_base = "lknitpdiscgolf2026.netlify.app?g="

const token = ['Anhyzer-Anvils', 'Ankle-Biters-Anonymous', 'Bark-Biters', 'Basket-Boggarts', 'Basket-Breakers', 'Basket-Breakers', 'Basket-Hanging-Hoodlums', 'Birdie-Bandits', 'Bonsai-Brigade', 'Bramble-Boys', 'Caddy-Cap-Crusaders', 'Chain-Bang-Chums', 'Chain-Bangers', 'Cobblestone-Kings', 'Compact-Commandos', 'Dahlia-Drivers', 'Double-Grip-Dwarves', 'Fairway-Faeries', 'Fairway-Felons', 'Fiends-of-Fairway', 'Foxglove-Flickers', 'Fun-Sized-Force', 'Garden-Gate-Gliders', 'Gnomish-Gentry', 'Granite-Gliders', 'Grass-Top-Gliders', 'Gravel-Pit-Putters', 'Grip-Lock-Goblins', 'Ground-Level-Grifters', 'Half-Pint-Phantoms', 'High-Speed-Hobgoblins', 'Inch-High-Imps', 'Knee-High-Knockouts', 'Knee-High-Knucklers', 'Leaf-Litter-Legion', 'Little-League-Legends', 'Loft-Shot-Lads', 'Low-Profile-Pros', 'Micro-Stature-Marauders', 'Miniature-Mountain-Men', 'Mithril-Midrangers', 'Mossy-Midrangers', 'Mound-Bound-Marauders', 'Mycelium-Marauders', 'Noggin-Gnomes', 'Overstable-Ogres', 'Pebble-Pushers', 'Petite-Power-Players', 'Petunia-Putters', 'Picket-Fence-Putters', 'Pint-Sized-Putters', 'Pipe-Puffers', 'Pocket-Sized-Putters', 'Porch-Sitters', 'Putter-Pocket-Pranksters', 'Putter-Prowlers', 'Rose-Thorn-Rollers', 'Scramble-Scoundrels', 'Shadow-Shortened-Scoundrels', 'Shank-Shifters', 'Shin-Height-Shufflers', 'Short-Range-Sharpshooters', 'Slightly-Small-Saboteurs', 'Small-Batch-Boys', 'Speckled-Spores', 'Spore-Sprouts', 'Stump-Hitters', 'Tee-Box-Terrors', 'Teeny-Tiny-Titans', 'The-Ace-Runners', 'The-Chains-Chasers', 'The-Grass-Stain-Gang', 'The-Low-Down-Dirty-Dogs', 'The-Minuscule-Misfits', 'The-Plastic-Heavyweights', 'The-Roller-Rebels', 'The-Thicket-Throwers', 'Tomahawk-Trolls', 'Trellis-Tossers', 'Turbo-Putt-Trolls', 'Turnover-Trowels', 'Verticality-Challenged', 'Wee-Folk-Warriors', 'Wheelbarrow-Wingers', 'Windy-Wizards'];

let total_qr_codes = token.length

let qr_print_arr = []
let rowFirst = []
let rowSecond = []

for (let i=0;i<total_qr_codes;i+=3){

 let payload = url_base + token[i]

 paddedRow = token.slice(i,i+3)

let rowSecond = Object.assign(["", "", ""], paddedRow);

 rowFirst = rowSecond.map((token) => {return `=IMAGE("https://quickchart.io/qr?text=" & "https://" & ENCODEURL("${url_base + token}"))`})
 qr_print_arr.push(rowFirst, rowSecond)

}
console.log(qr_print_arr)
*/

const url_base = getAppBaseUrl() + "?g="
// 5.16 testing if no spaces works on DuckDuckGo

const token =[{'token': 'Anhyzer-Anvils', 'group': '1A'}, {'token': 'Ankle-Biters-Anonymous', 'group': '1B'}, {'token': 'Bark-Biters', 'group': '1C'}, {'token': 'Basket-Boggarts', 'group': '1D'}, {'token': 'Basket-Breakers', 'group': '2A'}, {'token': 'Basket-Breakers', 'group': '2B'}, {'token': 'Basket-Hanging-Hoodlums', 'group': '2C'}, {'token': 'Birdie-Bandits', 'group': '2D'}, {'token': 'Bonsai-Brigade', 'group': '3A'}, {'token': 'Bramble-Boys', 'group': '3B'}, {'token': 'Caddy-Cap-Crusaders', 'group': '3C'}, {'token': 'Chain-Bang-Chums', 'group': '3D'}, {'token': 'Chain-Bangers', 'group': '4A'}, {'token': 'Cobblestone-Kings', 'group': '4B'}, {'token': 'Compact-Commandos', 'group': '4C'}, {'token': 'Dahlia-Drivers', 'group': '4D'}, {'token': 'Double-Grip-Dwarves', 'group': '5A'}, {'token': 'Fairway-Faeries', 'group': '5B'}, {'token': 'Fairway-Felons', 'group': '5C'}, {'token': 'Fiends-of-Fairway', 'group': '5D'}, {'token': 'Foxglove-Flickers', 'group': '6A'}, {'token': 'Fun-Sized-Force', 'group': '6B'}, {'token': 'Garden-Gate-Gliders', 'group': '6C'}, {'token': 'Gnomish-Gentry', 'group': '6D'}, {'token': 'Granite-Gliders', 'group': '7A'}, {'token': 'Grass-Top-Gliders', 'group': '7B'}, {'token': 'Gravel-Pit-Putters', 'group': '7C'}, {'token': 'Grip-Lock-Goblins', 'group': '7D'}, {'token': 'Ground-Level-Grifters', 'group': '8A'}, {'token': 'Half-Pint-Phantoms', 'group': '8B'}, {'token': 'High-Speed-Hobgoblins', 'group': '8C'}, {'token': 'Inch-High-Imps', 'group': '8D'}, {'token': 'Knee-High-Knockouts', 'group': '9A'}, {'token': 'Knee-High-Knucklers', 'group': '9B'}, {'token': 'Leaf-Litter-Legion', 'group': '9C'}, {'token': 'Little-League-Legends', 'group': '9D'}, {'token': 'Loft-Shot-Lads', 'group': '10A'}, {'token': 'Low-Profile-Pros', 'group': '10B'}, {'token': 'Micro-Stature-Marauders', 'group': '10C'}, {'token': 'Miniature-Mountain-Men', 'group': '10D'}, {'token': 'Mithril-Midrangers', 'group': '11A'}, {'token': 'Mossy-Midrangers', 'group': '11B'}, {'token': 'Mound-Bound-Marauders', 'group': '11C'}, {'token': 'Mycelium-Marauders', 'group': '11D'}, {'token': 'Noggin-Gnomes', 'group': '12A'}, {'token': 'Overstable-Ogres', 'group': '12B'}, {'token': 'Pebble-Pushers', 'group': '12C'}, {'token': 'Petite-Power-Players', 'group': '12D'}, {'token': 'Petunia-Putters', 'group': '13A'}, {'token': 'Picket-Fence-Putters', 'group': '13B'}, {'token': 'Pint-Sized-Putters', 'group': '13C'}, {'token': 'Pipe-Puffers', 'group': '13D'}, {'token': 'Pocket-Sized-Putters', 'group': '14A'}, {'token': 'Porch-Sitters', 'group': '14B'}, {'token': 'Putter-Pocket-Pranksters', 'group': '14C'}, {'token': 'Putter-Prowlers', 'group': '14D'}, {'token': 'Rose-Thorn-Rollers', 'group': '15A'}, {'token': 'Scramble-Scoundrels', 'group': '15B'}, {'token': 'Shadow-Shortened-Scoundrels', 'group': '15C'}, {'token': 'Shank-Shifters', 'group': '15D'}, {'token': 'Shin-Height-Shufflers', 'group': '16A'}, {'token': 'Short-Range-Sharpshooters', 'group': '16B'}, {'token': 'Slightly-Small-Saboteurs', 'group': '16C'}, {'token': 'Small-Batch-Boys', 'group': '16D'}, {'token': 'Speckled-Spores', 'group': '17A'}, {'token': 'Spore-Sprouts', 'group': '17B'}, {'token': 'Stump-Hitters', 'group': '17C'}, {'token': 'Tee-Box-Terrors', 'group': '17D'}, {'token': 'Teeny-Tiny-Titans', 'group': '18A'}, {'token': 'The-Ace-Runners', 'group': '18B'}, {'token': 'The-Chains-Chasers', 'group': '18C'}, {'token': 'The-Grass-Stain-Gang', 'group': '18D'}];

let total_qr_codes = token.length

let qr_print_arr = []

for (let i=0;i<total_qr_codes;i+=2){

 const paddedRow = token.slice(i,i+2)

let rowSecond = Object.assign(["", ""], paddedRow);

// use null instead of "" to get 'skip' behavior and avoid overwriting existing cells
// here we want an overwrite, so using "" or the existing value

 const rowFirst = rowSecond.map((token) => {return token == "" ? "" : `=IMAGE("https://quickchart.io/qr?text=" & "https://" & ENCODEURL("${url_base + token["token"]}"))`})
rowSecond = rowSecond.map((group) => {return !group ? "" : group["token"] + " " + group["group"]});
 qr_print_arr.push(rowFirst, rowSecond)

}
console.log(qr_print_arr)

qr_sheet.getRange(1,1,qr_print_arr.length,qr_print_arr[1].length).setValues(qr_print_arr)

 const sheetId = qr_sheet.getSheetId();
  const rowHeight = 250; // Desired height in pixels

  // Example: Change height for every other row (alternating)
  let targetRows = [];
  for (let i = 1; i <= 200; i += 2) {
    targetRows.push(i);
  }

  // Create an array of individual requests for each row
  let requests = targetRows.map(rowNum => {
    return {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: "ROWS",
          startIndex: rowNum - 1, // 0-indexed: Row 2 is index 1
          endIndex: rowNum       // endIndex is exclusive
        },
        properties: {
          pixelSize: rowHeight
        },
        fields: "pixelSize" // Only update the row height
      }
    };
  });

  // Execute all changes in a single API call
  try {
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
    console.log(`Successfully updated ${targetRows.length} rows.`);
  } catch (err) {
    console.log('Failed with error: ' + err.message);
  }


  // reusing template for convenience
  // Example: Change height for every other column (alternating)
  targetRows = [];
  for (let i = 1; i < 4; i++) {
    targetRows.push(i);
  }

  // Create an array of individual requests for each row
  requests = targetRows.map(rowNum => {
    return {
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: "COLUMNS",
          startIndex: rowNum - 1, // 0-indexed: Row 2 is index 1
          endIndex: rowNum       // endIndex is exclusive
        },
        properties: {
          pixelSize: rowHeight
        },
        fields: "pixelSize" // Only update the row height
      }
    };
  });

  // Execute all changes in a single API call
  try {
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId());
    console.log(`Successfully updated ${targetRows.length} rows.`);
  } catch (err) {
    console.log('Failed with error: ' + err.message);
  }



}


// ============================================================
// MANUAL RECALCULATE — TD runs from Apps Script menu
// ============================================================
function recalculateLeaderboard() {
  const ss = getEventSpreadsheet();
  rebuildLeaderboard(ss);
  rebuildHoleSummary(ss);
  SpreadsheetApp.getUi().alert('Leaderboard recalculated successfully.');
}

// ============================================================
// CORRECT A SCORE — TD runs interactively
// ============================================================
function correctScore() {
  const ui = SpreadsheetApp.getUi();
  const ss = getEventSpreadsheet();

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
    .addItem('Create QR Codes', 'createQRCodes')
    .addSeparator()
    .addItem('Recalculate leaderboard', 'recalculateLeaderboard')
    .addItem('Correct a score', 'correctScore')
    .addToUi();
}

function initializeSheets() {
  const ss = getEventSpreadsheet();
  ensureSheets(ss);
  SpreadsheetApp.getUi().alert('Sheets initialized. Ready for scoring.');
}

// ============================================================
// HELPER TO AGGREGATE LEADERBOARD REBUILD FUNCTIONS
//   should run in the background every _ minutes or similar,
//   that needs to be configured in AppScript dashboard
// ============================================================

function rebuildSteps(){

const ss = getEventSpreadsheet();
ensureSheets(ss);
rebuildLeaderboard(ss);
rebuildHoleSummary(ss);
// recalculateLeaderboard()  just does the above two steps, so syncing should be automatic
}
