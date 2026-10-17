/**
 * RUN THIS ONCE to set up the "Applications" sheet with all 55 headers + formatting.
 *
 * How to use:
 *   1. Go to script.google.com -> paste this in a new project.
 *   2. Click Run -> setupRecruitmentSheet
 *   3. Grant permissions when prompted.
 *   4. Done! Check your sheet.
 */

function setupRecruitmentSheet() {
  var SPREADSHEET_ID = "17bOt50n_5KuuKrhGYSID_vBj5p_2Tz-OOex3fuTy3b8";
  var SHEET_NAME = "Applications";

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Get or create the Applications sheet
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // Rename the first sheet if it's still called "Sheet1"
    var first = ss.getSheets()[0];
    if (first.getName() === "Sheet1") {
      first.setName(SHEET_NAME);
      sheet = first;
    } else {
      sheet = ss.insertSheet(SHEET_NAME, 0);
    }
  }

  var headers = [
    // Core
    "Application ID", "Cycle ID", "Status", "Full Name", "Email", "College Email",
    "Phone", "USN", "Year of Study", "Branch", "Selected Team", "Clubs / Orgs",
    "Why Join", "Weekly Hours",
    // Design
    "D: Worked Before", "D: Tools", "D: Past Work", "D: Admired URL", "D: Admired Explain",
    "D: Brand Name", "D: Brand Why", "D: Inspiration", "D: AI Tools", "D: Consistency",
    "D: Prioritise", "D: Interest",
    // Marketing
    "M: Areas", "M: Platforms", "M: Experience", "M: Portfolio Links", "M: Why Marketing",
    "M: Hackathon Promo", "M: Improve",
    // Events & Ops
    "E: WiFi Crash", "E: Engagement", "E: Priorities", "E: Teammate", "E: High Stakes", "E: Why Events",
    // Technical
    "T: Domains", "T: GitHub", "T: Portfolio", "T: DSA Profiles", "T: Projects",
    "T: Challenge", "T: Why Technical",
    // Outreach
    "O: Experience", "O: Sponsor Approach", "O: No Response", "O: Task Plan", "O: Why Outreach",
    // Meta
    "Has Design File", "Form Version", "Submitted At", "Sync Timestamp"
  ];

  // Write headers to row 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // -- Section color groups --------------------------------------------------
  var sections = [
    { start: 1,  end: 14, bg: "#1a1a1a",  fg: "#ffffff" }, // Core       — near-black
    { start: 15, end: 26, bg: "#0d2137",  fg: "#7ec8e3" }, // Design     — dark blue
    { start: 27, end: 33, bg: "#0d2415",  fg: "#6fcf97" }, // Marketing  — dark green
    { start: 34, end: 39, bg: "#2d1e06",  fg: "#f2994a" }, // Events     — dark amber
    { start: 40, end: 46, bg: "#1e0d2e",  fg: "#bb6bd9" }, // Technical  — dark purple
    { start: 47, end: 51, bg: "#2e0d0d",  fg: "#eb5757" }, // Outreach   — dark red
    { start: 52, end: 55, bg: "#1c1c1c",  fg: "#bdbdbd" }, // Meta       — dark grey
  ];

  for (var i = 0; i < sections.length; i++) {
    var s = sections[i];
    var range = sheet.getRange(1, s.start, 1, s.end - s.start + 1);
    range.setBackground(s.bg);
    range.setFontColor(s.fg);
    range.setFontWeight("bold");
    range.setFontSize(10);
    range.setHorizontalAlignment("center");
    range.setVerticalAlignment("middle");
    range.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  }

  // Freeze row 1
  sheet.setFrozenRows(1);

  // Set row height to 28px for the header
  sheet.setRowHeight(1, 28);

  // Auto-resize all columns
  sheet.autoResizeColumns(1, headers.length);

  // Set minimum widths for key columns
  sheet.setColumnWidth(1, 120);  // Application ID
  sheet.setColumnWidth(4, 160);  // Full Name
  sheet.setColumnWidth(5, 200);  // Email
  sheet.setColumnWidth(6, 200);  // College Email

  Logger.log("Done! " + headers.length + " headers written to '" + SHEET_NAME + "' sheet.");
}

