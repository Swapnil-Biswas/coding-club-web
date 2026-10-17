# Google Sheets Integration Guide — Recruitment 2026–27

The recruitment system uses **SQL as the primary durable source of truth** and **Google Sheets as an asynchronous operational backup/export**. Applications are immediately saved in SQLite with high integrity; if Google Sheets is temporarily unreachable, quota-limited, or not yet configured in `.env`, submissions will never be blocked or lost. All pending rows wait in a durable SQL outbox (`recruitment_sheets_outbox`) and sync automatically with exponential backoff and jitter.

---

## Option 1: Google Apps Script Web App (Recommended — 60 Seconds Setup)

This is the fastest method if you just want to create a Google Sheet and have it sync automatically without setting up a Google Cloud Console project or service accounts.

1. **Create your Google Spreadsheet** in Google Drive (name it e.g. `Coding Club Recruitment 2026–27`).
2. In the Google Sheets menu, click **Extensions** > **Apps Script**.
3. Replace the placeholder code in the editor with the code from:
   [`backend/scripts/google-apps-script-template.js`](file:///c:/Users/swapn/OneDrive/Desktop/codingclub%20backuppppp/coding-club-backup/backend/scripts/google-apps-script-template.js).
4. Click **Deploy** (top right) > **New deployment**.
5. Click the gear icon next to "Select type" and select **Web app**.
6. Set:
   - **Description**: `Recruitment Sync`
   - **Execute as**: `Me (<your-email>)`
   - **Who has access**: `Anyone` *(Note: this allows your backend server to POST rows to it)*
7. Click **Deploy**, and grant permissions when Google prompts you.
8. Copy the generated **Web app URL** (looks like `https://script.google.com/macros/s/.../exec`).
9. Paste it into your `backend/.env` file:
   ```env
   GOOGLE_SHEETS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```

---

## Option 2: Google Cloud Service Account (Official Google Sheets API v4)

If you prefer using official Google Cloud Service Account credentials:

1. Create a Google Spreadsheet in Google Drive and copy its URL:
   ```env
   GOOGLE_SHEETS_URL=https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
   ```
2. In Google Cloud Console, enable the **Google Sheets API**.
3. Create a **Service Account** and generate a JSON key.
4. Share your Google Spreadsheet with the service account email (with **Editor** permissions).
5. Put the compact JSON string into `backend/.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
   ```

---

## Verifying & Reconciling

- In the **Dashboard** > **Recruitment** tab, administrators can monitor:
  - **Total Applications**
  - **Synced to Sheets**
  - **Pending in Queue**
  - **Failed / Retrying**
- If Google Sheets was configured after applications were submitted, clicking **"Reconcile / Retry"** in the Recruitment Dashboard will automatically queue all unsynced applications to the sheet.
