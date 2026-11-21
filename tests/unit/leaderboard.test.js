// Unit tests for the pure helpers in apps_script/leaderboard/leaderboard_script.js.
const { loadAppsScript } = require("../helpers/loadAppsScript");

const { toDisplayRows } = loadAppsScript(
  ["apps_script/leaderboard/leaderboard_script.js"],
  ["toDisplayRows"],
);

// Leaderboard sheet: Place, Group, Players, Total Strokes, vs Par, Holes Played, Last Updated
const header = ["Place", "Group", "Players", "Total Strokes", "vs Par", "Holes Played", "Last updated: x"];

describe("toDisplayRows", () => {
  test("drops the header and keeps place, players and vs-par", () => {
    const data = [header, [1, "2B", "Alex & Sam", 50, "-5", 18, ""]];
    expect(toDisplayRows(data)).toEqual([[1, "Alex & Sam", "-5"]]);
  });

  test("skips rows whose Place is empty or null", () => {
    const data = [header, [1, "2B", "A", 50, "-5", 18, ""], ["", "", "", "", "", "", ""], [null, "x", "y", 0, "E", 0, ""]];
    expect(toDisplayRows(data)).toEqual([[1, "A", "-5"]]);
  });

  test("keeps the sheet's ranking order", () => {
    const data = [header, [1, "2B", "A", 50, "-5", 18, ""], [2, "1A", "B", 56, "+1", 18, ""]];
    expect(toDisplayRows(data).map((r) => r[0])).toEqual([1, 2]);
  });

  test("loading the file does not touch the spreadsheet (no top-level calls)", () => {
    // The default SpreadsheetApp stub throws on any access; loading above succeeded.
    expect(typeof toDisplayRows).toBe("function");
  });
});
