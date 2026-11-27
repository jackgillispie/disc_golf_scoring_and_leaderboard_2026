// Unit tests for the pure helpers in apps_script/backend/AppsScript_Code.js.
//
// Conventions:
// - `test(...)` pins CURRENT behaviour so refactors can't change it silently.
// - `test.failing(...)` documents a KNOWN BUG: the test states the CORRECT
//   behaviour and is expected to fail today. When phase 2 fixes the bug,
//   Jest will flag it. Then change `test.failing` to `test`.
const fs = require("fs");
const path = require("path");
const { loadAppsScript } = require("../helpers/loadAppsScript");

const {
  VALID_TOKENS,
  COURSE_HOLES,
  isValidToken,
  sanitizeSubmission,
  buildScoreRow,
  formatVsPar,
  aggregateLeaderboard,
  summarizeHoles,
  effectiveRows,
  buildCorrection,
} = loadAppsScript(
  ["apps_script/backend/AppsScript_Code.js"],
  [
    "VALID_TOKENS",
    "COURSE_HOLES",
    "isValidToken",
    "sanitizeSubmission",
    "buildScoreRow",
    "formatVsPar",
    "aggregateLeaderboard",
    "summarizeHoles",
    "effectiveRows",
    "buildCorrection",
  ],
);

// Token keys of GROUP_TOKENS in the single-file front end.
function frontendTokenKeys() {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "..", "app_files_for_netlify", "app", "index.html"),
    "utf8",
  );
  const block = html.match(/const GROUP_TOKENS = \{([\s\S]*?)\n\s*\};/);
  if (!block) throw new Error("GROUP_TOKENS block not found in index.html");
  return [...block[1].matchAll(/^\s*"([^"]+)":\s*\{/gm)].map((m) => m[1]);
}

const validSubmission = () => ({
  Tournament: "LKNITP Disc Bash 2026",
  Group: "1A",
  Token: "Anhyzer-Anvils",
  Players: "Alex & Sam",
  Hole: 1,
  Par: 3,
  Dist: 276,
  Score: 3,
  VsPar: 0,
  Timestamp: "2026-05-14T20:37:52.641Z",
});

// Raw Scores row: [receivedAt, Tournament, Group, Players, Hole, Par, Dist, Score, VsPar, Token]
const rawRow = (group, hole, score, { par = 3, players = "P" } = {}) => [
  "2026-05-14T20:00:00Z", "T", group, players, hole, par, 200, score, score - par, "tok",
];

// Corrections row: [Timestamp, Group, Hole, Score, Previous Score]
const corrRow = (group, hole, score) => ["2026-05-14T21:00:00Z", group, hole, score, 0];

describe("isValidToken", () => {
  test("accepts a token on the allow-list", () => {
    expect(isValidToken("Anhyzer-Anvils")).toBe(true);
  });

  test.each([undefined, null, "", "Not A Team"])("rejects %p", (token) => {
    expect(isValidToken(token)).toBe(false);
  });

  test("accepts every token the front end sends (hyphenated, e.g. \"Anhyzer-Anvils\")", () => {
    for (const token of frontendTokenKeys()) {
      expect(isValidToken(token)).toBe(true);
    }
  });
});

describe("token lists", () => {
  test("VALID_TOKENS has no duplicates", () => {
    expect(new Set(VALID_TOKENS).size).toBe(VALID_TOKENS.length);
  });

  test("front-end GROUP_TOKENS keys are unique (else a group is unreachable)", () => {
    const keys = frontendTokenKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("group URLs and QR codes (TD Tools) only hand out tokens the backend accepts", () => {
    // populateGroupTokens() and createQRCodes() each keep their own
    // [{token, group}] list; a token the backend rejects means that group's
    // scores are silently dropped.
    const src = fs.readFileSync(
      path.join(__dirname, "..", "..", "apps_script", "backend", "AppsScript_Code.js"),
      "utf8",
    );
    const lists = [...src.matchAll(/^\s*const tokens? ?= ?(\[\{'token'[^\n]*\]);/gm)];
    expect(lists).toHaveLength(2);
    const html = fs.readFileSync(
      path.join(__dirname, "..", "..", "app_files_for_netlify", "app", "index.html"),
      "utf8",
    );
    const appGroup = Object.fromEntries(
      [...html.matchAll(/^\s*"([^"]+)":\s*\{\s*group:\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]),
    );
    for (const [, literal] of lists) {
      const pairs = [...literal.matchAll(/'token': '([^']+)', 'group': '([^']+)'/g)].map((m) => [m[1], m[2]]);
      const tokens = pairs.map(([t]) => t);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.filter((t) => !isValidToken(t))).toEqual([]);
      expect(new Set(tokens).size).toBe(tokens.length); // one token per group
      // Same token -> group mapping as the app, so the QR code a group
      // receives opens the app on that group's starting hole.
      expect(pairs.filter(([t, g]) => appGroup[t] !== g)).toEqual([]);
    }
  });
});

describe("sanitizeSubmission", () => {
  test("passes a well-formed submission through unchanged", () => {
    expect(sanitizeSubmission(validSubmission())).toEqual(validSubmission());
  });

  test("blocks the XSS / script payloads from the old mockFunction()", () => {
    const clean = sanitizeSubmission({
      ...validSubmission(),
      Tournament: "javascript: alert(1)",
      Players: "<img src=x onerror=alert('Players')>",
    });
    expect(clean.Tournament).toBeNull();
    expect(clean.Players).toBeNull();
  });

  test.each([
    ["Players", "=IMPORTXML(\"http://x\",\"//a\")"],
    ["Players", "+1+1"],
    ["Tournament", "@SUM(A1)"],
  ])("blocks spreadsheet formula injection in %s: %p", (field, value) => {
    expect(sanitizeSubmission({ ...validSubmission(), [field]: value })[field]).toBeNull();
  });

  test.each([
    ["Group", "1a"], ["Group", "A1"], ["Group", "1AB"],
    ["Hole", "1.5"], ["Hole", "-1"], ["Hole", ""],
    ["Par", "three"], ["Dist", "200ft"], ["Score", " 3"],
    ["VsPar", "+1"], ["Timestamp", "not a date"],
  ])("invalid %s %p becomes null", (field, value) => {
    expect(sanitizeSubmission({ ...validSubmission(), [field]: value })[field]).toBeNull();
  });

  test("accepts numeric strings as well as numbers", () => {
    const clean = sanitizeSubmission({ ...validSubmission(), Hole: "18", Score: "4", VsPar: "-1" });
    expect(clean).toMatchObject({ Hole: "18", Score: "4", VsPar: "-1" });
  });

  test("current behaviour: VsPar allows any digit/hyphen mix (e.g. '--', '1-2')", () => {
    // Weak pattern; phase 2 should tighten to /^-?\d+$/.
    expect(sanitizeSubmission({ ...validSubmission(), VsPar: "--" }).VsPar).toBe("--");
    expect(sanitizeSubmission({ ...validSubmission(), VsPar: "1-2" }).VsPar).toBe("1-2");
  });

  test("Token is passed through untouched (it is validated earlier by isValidToken)", () => {
    const evil = "<script>x</script>";
    expect(sanitizeSubmission({ ...validSubmission(), Token: evil }).Token).toBe(evil);
  });
});

describe("buildScoreRow", () => {
  test("orders columns to match the Raw Scores headers", () => {
    const row = buildScoreRow(validSubmission(), "2026-05-14T21:00:00.000Z");
    expect(row).toEqual([
      "2026-05-14T21:00:00.000Z", // Timestamp (server receipt time)
      "LKNITP Disc Bash 2026",   // Tournament
      "1A",                      // Group
      "Alex & Sam",              // Players
      1, 3, 276, 3, 0,           // Hole, Par, Dist, Score, vs Par
      "Anhyzer-Anvils",          // Token
    ]);
  });
});

describe("formatVsPar", () => {
  test.each([[0, "E"], [2, "+2"], [-3, "-3"]])("%p -> %p", (diff, expected) => {
    expect(formatVsPar(diff)).toBe(expected);
  });
});

describe("aggregateLeaderboard", () => {
  test("totals strokes and par per group and ranks lowest vs-par first", () => {
    const result = aggregateLeaderboard([
      rawRow("1A", 1, 4), rawRow("1A", 2, 3), // +1
      rawRow("2B", 1, 2), rawRow("2B", 2, 3), // -1
    ]);
    expect(result.map((g) => [g.group, g.totalScore, g.totalPar, g.diff, g.holesPlayed])).toEqual([
      ["2B", 5, 6, -1, 2],
      ["1A", 7, 6, 1, 2],
    ]);
  });

  test("only the FIRST row per group + hole counts (server arrival order)", () => {
    const result = aggregateLeaderboard([
      rawRow("1A", 1, 5),
      rawRow("1A", 1, 2), // resubmission: ignored
    ]);
    expect(result[0]).toMatchObject({ totalScore: 5, holesPlayed: 1 });
  });

  test("players name comes from the last NEW hole submitted, not resubmissions", () => {
    const result = aggregateLeaderboard([
      rawRow("1A", 1, 3, { players: "First" }),
      rawRow("1A", 1, 3, { players: "Ignored" }),
      rawRow("1A", 2, 3, { players: "Second" }),
    ]);
    expect(result[0].players).toBe("Second");
  });

  test("handles an empty sheet", () => {
    expect(aggregateLeaderboard([])).toEqual([]);
  });

  test.failing("KNOWN BUG: rows whose Group failed validation are not merged into one fake team", () => {
    // sanitizeSubmission stores invalid groups as null -> String(null) === "null".
    const result = aggregateLeaderboard([rawRow(null, 1, 3), rawRow(null, 2, 3)]);
    expect(result.map((g) => g.group)).not.toContain("null");
  });
});

describe("summarizeHoles", () => {
  const holes = [{ n: 1, par: 3, dist: 276 }, { n: 2, par: 4, dist: 383 }];

  test("computes submissions, average (1 dp), best and birdie count per hole", () => {
    const rows = summarizeHoles(
      [rawRow("1A", 1, 2), rawRow("2B", 1, 3), rawRow("3C", 1, 4)],
      holes,
    );
    expect(rows[0]).toEqual([1, 3, 276, 3, 3, 2, 1]);
  });

  test("rounds the average to one decimal place", () => {
    const rows = summarizeHoles([rawRow("1A", 1, 2), rawRow("2B", 1, 3), rawRow("3C", 1, 3)], holes);
    expect(rows[0][4]).toBe(2.7);
  });

  test("shows placeholders for a hole with no submissions", () => {
    expect(summarizeHoles([], holes)[1]).toEqual([2, 4, 383, 0, "—", "—", 0]);
  });

  test("fed effectiveRows, resubmissions are not double-counted (same rule as the leaderboard)", () => {
    const rows = summarizeHoles(effectiveRows([rawRow("1A", 1, 3), rawRow("1A", 1, 2)]), holes);
    expect(rows[0][3]).toBe(1);
    expect(rows[0][5]).toBe(3); // first submission's score, not the resubmission's
  });

  test("fed effectiveRows, uses corrected scores", () => {
    const rows = summarizeHoles(effectiveRows([rawRow("1A", 1, 5)], [corrRow("1A", 1, 2)]), holes);
    expect(rows[0]).toEqual([1, 3, 276, 1, 2, 2, 1]);
  });
});

describe("effectiveRows (append-only corrections)", () => {
  test("keeps the first submission per group + hole, in arrival order", () => {
    const out = effectiveRows([rawRow("1A", 1, 4), rawRow("2B", 1, 3), rawRow("1A", 1, 2), rawRow("1A", 2, 3)]);
    expect(out.map((r) => [r[2], r[4], r[7]])).toEqual([["1A", 1, 4], ["2B", 1, 3], ["1A", 2, 3]]);
  });

  test("a correction overrides the score and vs par", () => {
    const [row] = effectiveRows([rawRow("1A", 1, 5)], [corrRow("1A", 1, 2)]);
    expect(row[7]).toBe(2);
    expect(row[8]).toBe(-1);
  });

  test("the LATEST correction wins (so a correction can be undone by correcting back)", () => {
    const [row] = effectiveRows([rawRow("1A", 1, 5)], [corrRow("1A", 1, 2), corrRow("1A", 1, 5)]);
    expect(row[7]).toBe(5);
  });

  test("never mutates the Raw Scores rows it was given", () => {
    const raw = [rawRow("1A", 1, 5)];
    const before = JSON.stringify(raw);
    effectiveRows(raw, [corrRow("1A", 1, 2)]);
    expect(JSON.stringify(raw)).toBe(before);
  });

  test("matches sheet values loosely (hole read as number or string)", () => {
    const [row] = effectiveRows([rawRow("1A", 1, 5)], [corrRow("1A", "1", "3")]);
    expect(row[7]).toBe(3);
  });

  test("ignores corrections for a group + hole with no submission", () => {
    const out = effectiveRows([rawRow("1A", 1, 3)], [corrRow("2B", 1, 2)]);
    expect(out).toHaveLength(1);
    expect(out[0][7]).toBe(3);
  });

  test("feeds the leaderboard: corrected totals", () => {
    const result = aggregateLeaderboard(effectiveRows(
      [rawRow("1A", 1, 5), rawRow("1A", 2, 3)],
      [corrRow("1A", 1, 3)],
    ));
    expect(result[0]).toMatchObject({ totalScore: 6, diff: 0, holesPlayed: 2 });
  });
});

describe("buildCorrection", () => {
  const AT = "2026-11-27T18:00:00.000Z";
  const raw = [rawRow("1A", 1, 5), rawRow("1A", 1, 4)];

  test("returns the Corrections row: timestamp, group, hole, new score, previous score", () => {
    expect(buildCorrection("1A", "1", "3", raw, [], AT)).toEqual({ row: [AT, "1A", 1, 3, 5] });
  });

  test("previous score is the current effective score (after earlier corrections)", () => {
    expect(buildCorrection("1A", 1, 4, raw, [corrRow("1A", 1, 3)], AT).row[4]).toBe(3);
  });

  test("normalises the group (trim, upper case)", () => {
    expect(buildCorrection(" 1a ", 1, 3, raw, [], AT).row[1]).toBe("1A");
  });

  test.each([
    ["hole not a number", "1A", "one", "3", /Hole/],
    ["score not a number", "1A", "1", "three", /Score/],
    ["score of zero", "1A", "1", "0", /Score/],
    ["negative score", "1A", "1", "-2", /Score/],
    ["unknown group", "9Z", "1", "3", /No score found for 9Z hole 1/],
    ["hole with no submission", "1A", "7", "3", /No score found/],
    ["same as current score", "1A", "1", "5", /already 5/],
  ])("rejects %s", (_, group, hole, score, message) => {
    const result = buildCorrection(group, hole, score, raw, [], AT);
    expect(result.row).toBeUndefined();
    expect(result.error).toMatch(message);
  });
});

describe("COURSE_HOLES", () => {
  test("is the 18-hole, par-55 Brackett's Bluff layout", () => {
    expect(COURSE_HOLES.map((h) => h.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(COURSE_HOLES.reduce((sum, h) => sum + h.par, 0)).toBe(55);
  });
});
