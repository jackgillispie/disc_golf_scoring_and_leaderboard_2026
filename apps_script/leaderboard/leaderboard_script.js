// Serves the HTML file to the web
function doGet() {
  return HtmlService.createTemplateFromFile('leaderboard')
    .evaluate()
    .setTitle('Leaderboard Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Fetches data to be used by the front-end
function getLeaderboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Leaderboard'); // Adjust to your sheet name
  const data = sheet.getDataRange().getValues();
  return toDisplayRows(data);
}

// PURE: unit-tested with Jest (tests/unit). No Apps Script services here.
// Leaderboard sheet values (with header) -> [place, players, vsPar] rows,
// skipping rows whose Place column is empty.
function toDisplayRows(data) {
  return data.slice(1)
    .map(row => [row[0], row[2], row[4]])
    .filter(row => row[0] !== "" && row[0] !== null);
}

function onFailure(){
  return ["An error occurred"]
}

// Note: a bare top-level `getLeaderboardData()` call used to sit here.
// Top-level code runs on EVERY execution in the project, so it was removed.
