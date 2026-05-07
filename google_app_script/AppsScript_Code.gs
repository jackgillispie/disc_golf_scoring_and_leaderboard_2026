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

// Valid tokens — must match GROUP_TOKENS in the HTML file
const VALID_TOKENS = ['Slightly-Small Saboteurs', 'Double-Grip Dwarves', 'Ankle-Biters Anonymous', 'Gravel-Pit Putters', 'Fairway-Finder Fiends', 'Flex-Shot Phantoms', 'Basket Boggarts', 'Rose-Thorn Rollers', 'The Vertical-Limit Voiders', 'Miniature Mountain-Men', 'Backshot Bark Biters', 'Putter-Pocket Pranksters', 'Caddy-Cap Crusaders', 'Anhyzer Anvils', 'Anvil Approaches', 'Chain-Bang Chums', 'Birdie Bandits', 'The Minuscule Misfits', 'Scramble Scoundrels', 'Compact Commandos', 'Turbo-Putt Trolls', 'Below-the-Belt Bandits', 'Fairway Faeries', 'Nose-Angle Knaves', 'Trellis Tossers', 'Basket Breakers', 'Grip-Lock Goblins', 'Circle One Centurions', 'Flicker-Fire Imps', 'Thumber Thugs', 'Little-League Legends', 'The Chains Chasers', 'Loft-Shot Lads', 'The Roller Rebels', 'High-Speed Hobgoblins', 'Basket-Case Burglars', 'The Plastic Heavyweights', 'Cobblestone Kings', 'Bogey Brownies', 'Porch Sitters', 'The Grass-Top Gliders', 'The Short-Range Sharpshooters', 'Off-the-Fairway Outlaws', 'Spore Sprouts', 'The Teeny-Tiny Titans', 'Gnomish Gentry', 'Sub-Clover Squad', 'Foxglove Flickers', 'Tunnel-Shot Troglodytes', 'Pipe Puffers', 'Bonsai Brigade', 'Mycelium Marauders', 'Under-the-Radar Rogues', 'Windy Wizards', 'Hyzer Hijackers', 'Inch-High Iron-Leaves', 'Stump-Hitters', 'Basket-Hanging Hoodlums', 'Small-Batch Bad-Boys', 'Garden Gate Gliders', 'The Shin-Height Shufflers', 'Iron-Leaf Infantry', 'Basket BreakersGranite Gliders', 'Disc-Golf Diggers', 'Half-Pint Phantoms', 'Tulip Tomahawks', 'Wheelbarrow Wingers', 'Tee-Box Terrors', 'Verticality Challenged', 'Mando Mischief', 'Dead-Straight Dwarves', 'Pebble Pushers', 'Knee-High Knucklers', 'Over-the-Hedge Hyzers', 'Bark Biters', 'The Pocket-Sized Putters', 'Tomahawk Trolls', 'The Grass-Stain Gang', 'Stable Stalagmites', 'The Thicket Throwers', 'Spit-Out Sprites', 'Mithril Midranges', 'Marigold Mashers', 'Petunia Putters', 'Bramble Birdies', 'Granite Gliders', 'Putter Prowlers', 'The Low-Down Dirty Dogs', 'The Ace Runners', 'Turnover Trowels', 'Mossy Midrangers', 'Knee-High Knockouts', 'Dahlia Drivers', 'Maximum Distance Miscreants', 'Ground-Level Grifters', 'Overstable Ogres', 'Leaf Litter Legion', 'Petite-Power Players', 'Fairway Felons', 'Picket-Fence Putters', 'Understable Undercroft', 'The Pint-Sized Putters', 'Par-Saving Pixies', 'The Low-Profile Pros', 'The Shank Shifters', 'Sceckled Spores', 'Mound-Bound Marauders', 'Fun-Sized Force', 'Shadow-Shortened Scoundrels', 'The Wee-Folk Warriors', 'Low-Ceiling Lurkers', 'Micro-Stature Marauders', ];

// ============================================================
// ENTRY POINT — POST from scorecard app
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Token validation — reject submissions without valid token
    if (!data.Token || !VALID_TOKENS.includes(data.Token)) {
      return respond({ status: 'error', message: 'Invalid group token' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);
    writeScore(ss, data);

    //5.4 pulling these out, will put them in a timer or something similar
    // rebuildLeaderboard(ss);
    // rebuildHoleSummary(ss);

    // to send on the frontend, recommended to wrap the getResponseText
    // in ContentService.createTextOutput(JSON...

    return ContentService.createTextOutput(
    JSON.stringify({status: "ok", "message": `Score for hole ${data.hole} recorded`}))
    .setMimeType(ContentService.MimeType.JSON);

    // return respond({ status: 'ok', hole: data.hole, group: data.group });

  } catch(err) {

    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
    .setMimeType(ContentService.MimeType.JSON)

    // return respond({ status: 'error', message: err.toString() });
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
  // Append new score
  // timestamp here reflects when it hits the server, not when frontend sent submission
  sheet.appendRow([
    new Date().toISOString(),
    data.Tournament,
    data.Group,
    data.Players,
    data.Hole,
    data.Par,
    data.Dist,
    data.Score,
    data.VsPar,
    data.Token
  ]);

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

  const now = new Date().toISOString();

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
  const BASE_URL = 'lknitpdiscgolf2026.netlify.app';

  const tokens = [{'token': 'Slightly-Small Saboteurs', 'group': 'Slightly-Small Saboteurs'}, {'token': 'Double-Grip Dwarves', 'group': 'Double-Grip Dwarves'}, {'token': 'Ankle-Biters Anonymous', 'group': 'Ankle-Biters Anonymous'}, {'token': 'Gravel-Pit Putters', 'group': 'Gravel-Pit Putters'}, {'token': 'Fairway-Finder Fiends', 'group': 'Fairway-Finder Fiends'}, {'token': 'Flex-Shot Phantoms', 'group': 'Flex-Shot Phantoms'}, {'token': 'Basket Boggarts', 'group': 'Basket Boggarts'}, {'token': 'Rose-Thorn Rollers', 'group': 'Rose-Thorn Rollers'}, {'token': 'The Vertical-Limit Voiders', 'group': 'The Vertical-Limit Voiders'}, {'token': 'Miniature Mountain-Men', 'group': 'Miniature Mountain-Men'}, {'token': 'Backshot Bark Biters', 'group': 'Backshot Bark Biters'}, {'token': 'Putter-Pocket Pranksters', 'group': 'Putter-Pocket Pranksters'}, {'token': 'Caddy-Cap Crusaders', 'group': 'Caddy-Cap Crusaders'}, {'token': 'Anhyzer Anvils', 'group': 'Anhyzer Anvils'}, {'token': 'Anvil Approaches', 'group': 'Anvil Approaches'}, {'token': 'Chain-Bang Chums', 'group': 'Chain-Bang Chums'}, {'token': 'Birdie Bandits', 'group': 'Birdie Bandits'}, {'token': 'The Minuscule Misfits', 'group': 'The Minuscule Misfits'}, {'token': 'Scramble Scoundrels', 'group': 'Scramble Scoundrels'}, {'token': 'Compact Commandos', 'group': 'Compact Commandos'}, {'token': 'Turbo-Putt Trolls', 'group': 'Turbo-Putt Trolls'}, {'token': 'Below-the-Belt Bandits', 'group': 'Below-the-Belt Bandits'}, {'token': 'Fairway Faeries', 'group': 'Fairway Faeries'}, {'token': 'Nose-Angle Knaves', 'group': 'Nose-Angle Knaves'}, {'token': 'Trellis Tossers', 'group': 'Trellis Tossers'}, {'token': 'Basket Breakers', 'group': 'Basket Breakers'}, {'token': 'Grip-Lock Goblins', 'group': 'Grip-Lock Goblins'}, {'token': 'Circle One Centurions', 'group': 'Circle One Centurions'}, {'token': 'Flicker-Fire Imps', 'group': 'Flicker-Fire Imps'}, {'token': 'Thumber Thugs', 'group': 'Thumber Thugs'}, {'token': 'Little-League Legends', 'group': 'Little-League Legends'}, {'token': 'The Chains Chasers', 'group': 'The Chains Chasers'}, {'token': 'Loft-Shot Lads', 'group': 'Loft-Shot Lads'}, {'token': 'The Roller Rebels', 'group': 'The Roller Rebels'}, {'token': 'High-Speed Hobgoblins', 'group': 'High-Speed Hobgoblins'}, {'token': 'Basket-Case Burglars', 'group': 'Basket-Case Burglars'}, {'token': 'The Plastic Heavyweights', 'group': 'The Plastic Heavyweights'}, {'token': 'Cobblestone Kings', 'group': 'Cobblestone Kings'}, {'token': 'Bogey Brownies', 'group': 'Bogey Brownies'}, {'token': 'Porch Sitters', 'group': 'Porch Sitters'}, {'token': 'The Grass-Top Gliders', 'group': 'The Grass-Top Gliders'}, {'token': 'The Short-Range Sharpshooters', 'group': 'The Short-Range Sharpshooters'}, {'token': 'Off-the-Fairway Outlaws', 'group': 'Off-the-Fairway Outlaws'}, {'token': 'Spore Sprouts', 'group': 'Spore Sprouts'}, {'token': 'The Teeny-Tiny Titans', 'group': 'The Teeny-Tiny Titans'}, {'token': 'Gnomish Gentry', 'group': 'Gnomish Gentry'}, {'token': 'Sub-Clover Squad', 'group': 'Sub-Clover Squad'}, {'token': 'Foxglove Flickers', 'group': 'Foxglove Flickers'}, {'token': 'Tunnel-Shot Troglodytes', 'group': 'Tunnel-Shot Troglodytes'}, {'token': 'Pipe Puffers', 'group': 'Pipe Puffers'}, {'token': 'Bonsai Brigade', 'group': 'Bonsai Brigade'}, {'token': 'Mycelium Marauders', 'group': 'Mycelium Marauders'}, {'token': 'Under-the-Radar Rogues', 'group': 'Under-the-Radar Rogues'}, {'token': 'Windy Wizards', 'group': 'Windy Wizards'}, {'token': 'Hyzer Hijackers', 'group': 'Hyzer Hijackers'}, {'token': 'Inch-High Iron-Leaves', 'group': 'Inch-High Iron-Leaves'}, {'token': 'Stump-Hitters', 'group': 'Stump-Hitters'}, {'token': 'Basket-Hanging Hoodlums', 'group': 'Basket-Hanging Hoodlums'}, {'token': 'Small-Batch Bad-Boys', 'group': 'Small-Batch Bad-Boys'}, {'token': 'Garden Gate Gliders', 'group': 'Garden Gate Gliders'}, {'token': 'The Shin-Height Shufflers', 'group': 'The Shin-Height Shufflers'}, {'token': 'Iron-Leaf Infantry', 'group': 'Iron-Leaf Infantry'}, {'token': 'Basket BreakersGranite Gliders', 'group': 'Basket BreakersGranite Gliders'}, {'token': 'Disc-Golf Diggers', 'group': 'Disc-Golf Diggers'}, {'token': 'Half-Pint Phantoms', 'group': 'Half-Pint Phantoms'}, {'token': 'Tulip Tomahawks', 'group': 'Tulip Tomahawks'}, {'token': 'Wheelbarrow Wingers', 'group': 'Wheelbarrow Wingers'}, {'token': 'Tee-Box Terrors', 'group': 'Tee-Box Terrors'}, {'token': 'Verticality Challenged', 'group': 'Verticality Challenged'}, {'token': 'Mando Mischief', 'group': 'Mando Mischief'}, {'token': 'Dead-Straight Dwarves', 'group': 'Dead-Straight Dwarves'}, {'token': 'Pebble Pushers', 'group': 'Pebble Pushers'}, {'token': 'Knee-High Knucklers', 'group': 'Knee-High Knucklers'}, {'token': 'Over-the-Hedge Hyzers', 'group': 'Over-the-Hedge Hyzers'}, {'token': 'Bark Biters', 'group': 'Bark Biters'}, {'token': 'The Pocket-Sized Putters', 'group': 'The Pocket-Sized Putters'}, {'token': 'Tomahawk Trolls', 'group': 'Tomahawk Trolls'}, {'token': 'The Grass-Stain Gang', 'group': 'The Grass-Stain Gang'}, {'token': 'Stable Stalagmites', 'group': 'Stable Stalagmites'}, {'token': 'The Thicket Throwers', 'group': 'The Thicket Throwers'}, {'token': 'Spit-Out Sprites', 'group': 'Spit-Out Sprites'}, {'token': 'Mithril Midranges', 'group': 'Mithril Midranges'}, {'token': 'Marigold Mashers', 'group': 'Marigold Mashers'}, {'token': 'Petunia Putters', 'group': 'Petunia Putters'}, {'token': 'Bramble Birdies', 'group': 'Bramble Birdies'}, {'token': 'Granite Gliders', 'group': 'Granite Gliders'}, {'token': 'Putter Prowlers', 'group': 'Putter Prowlers'}, {'token': 'The Low-Down Dirty Dogs', 'group': 'The Low-Down Dirty Dogs'}, {'token': 'The Ace Runners', 'group': 'The Ace Runners'}, {'token': 'Turnover Trowels', 'group': 'Turnover Trowels'}, {'token': 'Mossy Midrangers', 'group': 'Mossy Midrangers'}, {'token': 'Knee-High Knockouts', 'group': 'Knee-High Knockouts'}, {'token': 'Dahlia Drivers', 'group': 'Dahlia Drivers'}, {'token': 'Maximum Distance Miscreants', 'group': 'Maximum Distance Miscreants'}, {'token': 'Ground-Level Grifters', 'group': 'Ground-Level Grifters'}, {'token': 'Overstable Ogres', 'group': 'Overstable Ogres'}, {'token': 'Leaf Litter Legion', 'group': 'Leaf Litter Legion'}, {'token': 'Petite-Power Players', 'group': 'Petite-Power Players'}, {'token': 'Fairway Felons', 'group': 'Fairway Felons'}, {'token': 'Picket-Fence Putters', 'group': 'Picket-Fence Putters'}, {'token': 'Understable Undercroft', 'group': 'Understable Undercroft'}, {'token': 'The Pint-Sized Putters', 'group': 'The Pint-Sized Putters'}, {'token': 'Par-Saving Pixies', 'group': 'Par-Saving Pixies'}, {'token': 'The Low-Profile Pros', 'group': 'The Low-Profile Pros'}, {'token': 'The Shank Shifters', 'group': 'The Shank Shifters'}, {'token': 'Sceckled Spores', 'group': 'Sceckled Spores'}, {'token': 'Mound-Bound Marauders', 'group': 'Mound-Bound Marauders'}, {'token': 'Fun-Sized Force', 'group': 'Fun-Sized Force'}, {'token': 'Shadow-Shortened Scoundrels', 'group': 'Shadow-Shortened Scoundrels'}, {'token': 'The Wee-Folk Warriors', 'group': 'The Wee-Folk Warriors'}, {'token': 'Low-Ceiling Lurkers', 'group': 'Low-Ceiling Lurkers'}, {'token': 'Micro-Stature Marauders', 'group': 'Micro-Stature Marauders'},];

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

// ============================================================
// HELPER TO AGGREGATE LEADERBOARD REBUILD FUNCTIONS
//   should run in the background every _ minutes or similar,
//   that needs to be configured in AppScript dashboard
// ============================================================

function rebuildSteps(){

const ss = SpreadsheetApp.getActiveSpreadsheet();
ensureSheets(ss);
rebuildLeaderboard(ss);
rebuildHoleSummary(ss);
// recalculateLeaderboard()  just does the above two steps, so syncing should be automatic
}
