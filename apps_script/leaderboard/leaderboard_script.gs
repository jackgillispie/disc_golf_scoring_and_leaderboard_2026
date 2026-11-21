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
  console.log(data)
// 1. Remove the header
  // 2. Filter out rows where the first column (Name) is empty
  // 3. Sort by score (descending)

  // extract place, players, vspar to display
  const rows = data.slice(1)
    .map(rows => [rows[0], rows[2], rows[4]])
    .filter(row => row[0] !== "" && row[0] !== null)
    // .sort((a, b) => b[1] - a[1]);
  console.log(rows)
  return rows;
}

function onFailure(){
  return ["An error occurred"]
}

getLeaderboardData()
