/**
 * Coding Club Recruitment — Google Sheets Sync Webhook
 * -----------------------------------------------------
 * Deploy as a Web App:
 *   1. Open script.google.com -> New Project -> paste this code.
 *   2. Click Deploy -> New Deployment -> Type: Web App.
 *   3. Execute as: Me (your Google account).
 *   4. Who has access: Anyone (or "Anyone, even anonymous").
 *   5. Click Deploy -> copy the Web App URL.
 *   6. Paste into backend/.env as:
 *        GOOGLE_SHEETS_WEBHOOK_URL=<paste url here>
 *
 * The backend sends POST { action: "upsert", applicationId, columns, row }
 */

var SPREADSHEET_ID = "17bOt50n_5KuuKrhGYSID_vBj5p_2Tz-OOex3fuTy3b8";
var SHEET_NAME = "Applications";

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.action === "upsert") {
      upsertRow(payload.applicationId, payload.columns, payload.row);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: "coding-club-sheets-sync" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function upsertRow(applicationId, columns, row) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Ensure header row
  var headerCell = sheet.getRange(1, 1, 1, 1).getValue();
  if (headerCell !== "Application ID") {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight("bold");
    sheet.setColumnWidth(4, 160);
    sheet.setColumnWidth(5, 200);
  }

  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow > 1) {
    var idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idColumn.length; i++) {
      if (String(idColumn[i][0]) === String(applicationId)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    var newRow = sheet.getLastRow();
    if (newRow % 2 === 0) {
      sheet.getRange(newRow, 1, 1, row.length).setBackground("#f8f9fa");
    }
  }
  sheet.autoResizeColumn(3);
}
