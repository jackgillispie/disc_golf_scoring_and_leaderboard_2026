// ============================================================
// TD TOOLS MENU — the script BOUND to each event spreadsheet.
//
// The backend is a standalone project, and only a bound script can add a
// menu to a spreadsheet or show its dialogs. This project stays tiny: it
// builds the menu and forwards each item to the backend, which it uses as
// the Apps Script library "Backend" (see appsscript.json; the deploy script
// points it at the environment's backend project).
//
// The backend code then runs in this sheet's UI context, so its alerts and
// prompts work. It still reads the BACKEND's Script Properties (library
// scope), so the menu and the web app always use the same spreadsheet.
//
// The library is in development mode (always the backend's latest pushed
// code, which is what CI deploys). That requires everyone who uses this
// menu to have EDITOR access to the backend project.
// ============================================================

// [menu label, function in this file]. Keep in sync with the functions
// below; a unit test checks each one exists and calls a backend function.
const TD_MENU_ITEMS = [
  ['Initialize sheets', 'initializeSheets'],
  ['Generate group URLs', 'populateGroupTokens'],
  ['Create QR Codes', 'createQRCodes'],
  null, // separator
  ['Recalculate leaderboard', 'recalculateLeaderboard'],
  ['Correct a score', 'correctScore'],
];

function onOpen() {
  const menu = SpreadsheetApp.getUi().createMenu('TD Tools');
  TD_MENU_ITEMS.forEach(item => {
    if (item) menu.addItem(item[0], item[1]);
    else menu.addSeparator();
  });
  menu.addToUi();
}

// Menu items must name functions of THIS project, so each one forwards to
// the backend function of the same name.
function initializeSheets()       { Backend.initializeSheets(); }
function populateGroupTokens()    { Backend.populateGroupTokens(); }
function createQRCodes()          { Backend.createQRCodes(); }
function recalculateLeaderboard() { Backend.recalculateLeaderboard(); }
function correctScore()           { Backend.correctScore(); }
