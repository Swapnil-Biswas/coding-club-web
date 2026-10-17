/**
 * Google Apps Script Web App Template for Coding Club Recruitment 2026-27
 * 
 * SETUP INSTRUCTIONS (Takes ~1 minute):
 * 1. Create a new Google Spreadsheet in Google Drive (or open your existing one).
 * 2. In Google Sheets menu, click: Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this entire file.
 * 4. Click "Deploy" > "New deployment".
 * 5. Click the gear icon (Select type) > "Web app".
 * 6. Set Description: "Recruitment Sync".
 * 7. Set "Execute as": "Me" (your email).
 * 8. Set "Who has access": "Anyone". (CRITICAL)
 * 9. Click "Deploy", authorize permissions when prompted.
 * 10. Copy the "Web app URL" (looks like https://script.google.com/macros/s/.../exec).
 * 11. Paste it into your backend .env file:
 *     GOOGLE_SHEETS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
 * 
 * That's it! Every recruitment application will automatically be synced to this Sheet
 * in the "Applications" tab, with idempotent updates and column headers.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Applications");

    // If sheet doesn't exist, create it and add header row
    if (!sheet) {
      sheet = ss.insertSheet("Applications");
      if (data.columns && data.columns.length > 0) {
        sheet.appendRow(data.columns);
        sheet.getRange(1, 1, 1, data.columns.length).setFontWeight("bold");
        sheet.setFrozenRows(1);
      }
    }

    var row = data.row;
    var appId = data.applicationId;
    if (!row || !appId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing row or applicationId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Check if row with applicationId already exists (Idempotent upsert)
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(appId)) {
        rowIndex = i + 1; // 1-indexed row
        break;
      }
    }

    if (rowIndex > 0) {
      // Update existing row
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      // Append new row
      sheet.appendRow(row);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok", action: rowIndex > 0 ? "updated" : "inserted" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Coding Club Recruitment Google Sheets Sync Webhook is active.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
