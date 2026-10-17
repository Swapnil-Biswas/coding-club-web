// Google Sheets synchronization worker.
// Uses the Google Sheets API v4 via the official googleapis npm package.
// Runs asynchronously — never on the submission request path.
//
// The GOOGLE_SHEETS_URL env variable must be the full URL of the spreadsheet
// (https://docs.google.com/spreadsheets/d/SHEET_ID/...). We extract the
// spreadsheet ID from this URL.
//
// For auth, we use a Google service account JSON key stored in
// GOOGLE_SERVICE_ACCOUNT_JSON env variable.

import { google, type sheets_v4 } from 'googleapis';
import { getAll, getOne, runQuery } from '../db.js';
import { sanitizeForSheets } from './validation.js';
import type { ApplicationRow, SheetsSyncRow } from './types.js';

const BATCH_SIZE = 20;
const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 5_000;   // 5 s initial, exponential
const MAX_BACKOFF_MS  = 300_000; // 5 min cap

// ─── Column map (stable, never reorder) ───────────────────────────────────────

const COLUMNS = [
  'Application ID',
  'Cycle ID',
  'Status',
  'Full Name',
  'Email',
  'College Email',
  'Phone',
  'USN',
  'Year of Study',
  'Branch',
  'Selected Team',
  'Clubs / Orgs',
  'Why Join',
  'Weekly Hours',
  // Design
  'D: Worked Before',
  'D: Tools',
  'D: Past Work',
  'D: Admired URL',
  'D: Admired Explain',
  'D: Brand Name',
  'D: Brand Why',
  'D: Inspiration',
  'D: AI Tools',
  'D: Consistency',
  'D: Prioritise',
  'D: Interest',
  // Marketing
  'M: Areas',
  'M: Platforms',
  'M: Experience',
  'M: Portfolio Links',
  'M: Why Marketing',
  'M: Hackathon Promo',
  'M: Improve',
  // Events & Ops
  'E: WiFi Crash',
  'E: Engagement',
  'E: Priorities',
  'E: Teammate',
  'E: High Stakes',
  'E: Why Events',
  // Technical
  'T: Domains',
  'T: GitHub',
  'T: Portfolio',
  'T: DSA Profiles',
  'T: Projects',
  'T: Challenge',
  'T: Why Technical',
  // Outreach
  'O: Experience',
  'O: Sponsor Approach',
  'O: No Response',
  'O: Task Plan',
  'O: Why Outreach',
  // Meta
  'Has Design File',
  'Form Version',
  'Submitted At',
  'Sync Timestamp',
];

function buildRow(app: ApplicationRow, hasFile: boolean): string[] {
  let tr: Record<string, unknown> = {};
  try { tr = JSON.parse(app.team_responses); } catch { /* ignore */ }

  function cell(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return sanitizeForSheets(v.join(', '));
    return sanitizeForSheets(String(v));
  }

  return [
    app.id, app.cycle_id, app.status, app.full_name, app.email, app.college_email,
    app.phone, app.usn, app.year_of_study, app.branch, app.selected_team,
    cell(app.clubs_orgs), cell(app.why_join), app.weekly_hours,
    // Design
    cell(tr.design_worked_before), cell(tr.design_tools), cell(tr.design_past_work),
    cell(tr.design_admired_url), cell(tr.design_admired_explain), cell(tr.design_brand_name),
    cell(tr.design_brand_why), cell(tr.design_inspiration), cell(tr.design_ai_tools),
    cell(tr.design_consistency), cell(tr.design_prioritise), cell(tr.design_interest),
    // Marketing
    cell(tr.marketing_areas), cell(tr.marketing_platforms), cell(tr.marketing_experience),
    cell(tr.marketing_portfolio_links), cell(tr.marketing_why),
    cell(tr.marketing_hackathon_promo), cell(tr.marketing_improve),
    // Events
    cell(tr.events_wifi_crash), cell(tr.events_engagement), cell(tr.events_priorities),
    cell(tr.events_teammate), cell(tr.events_highstakes), cell(tr.events_why),
    // Technical
    cell(tr.tech_domains), cell(tr.tech_github), cell(tr.tech_portfolio),
    cell(tr.tech_dsa_profiles), cell(tr.tech_projects), cell(tr.tech_challenge),
    cell(tr.tech_why),
    // Outreach
    cell(tr.outreach_experience), cell(tr.outreach_sponsor_approach),
    cell(tr.outreach_no_response), cell(tr.outreach_task), cell(tr.outreach_why),
    // Meta
    hasFile ? 'Yes' : 'No',
    app.form_version,
    app.submitted_at,
    new Date().toISOString(),
  ];
}

// ─── Sheets client ────────────────────────────────────────────────────────────

let sheetsClient: sheets_v4.Sheets | null = null;
let spreadsheetId: string | null = null;

function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return match?.[1] ?? null;
}

function getWebhookUrl(): string | null {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (webhookUrl) return webhookUrl;
  const sheetUrl = process.env.GOOGLE_SHEETS_URL?.trim();
  if (sheetUrl && sheetUrl.includes('script.google.com/macros/s/')) return sheetUrl;
  return null;
}

function getSheetsClient(): { sheets: sheets_v4.Sheets; spreadsheetId: string } | null {
  const sheetUrl = process.env.GOOGLE_SHEETS_URL?.trim();
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (!sheetUrl || !saJson) return null;

  if (!sheetsClient) {
    try {
      const credentials = JSON.parse(saJson);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      sheetsClient = google.sheets({ version: 'v4', auth });
      spreadsheetId = extractSpreadsheetId(sheetUrl);
    } catch (e) {
      console.error('[sheets] failed to initialize client', e);
      return null;
    }
  }

  if (!sheetsClient || !spreadsheetId) return null;
  return { sheets: sheetsClient, spreadsheetId };
}

// ─── Ensure header row exists ─────────────────────────────────────────────────

async function ensureHeaderRow(sheets: sheets_v4.Sheets, sid: string): Promise<void> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: 'Applications!A1:A1',
    });
    const val = res.data.values?.[0]?.[0];
    if (val === 'Application ID') return; // header exists

    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: 'Applications!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [COLUMNS] },
    });
  } catch (e) {
    console.error('[sheets] failed to ensure header row', e);
  }
}

// ─── Upsert a row by Application ID (idempotent) ──────────────────────────────

async function upsertRow(
  sheets: sheets_v4.Sheets,
  sid: string,
  rowData: string[],
  applicationId: string,
): Promise<void> {
  // Find existing row by application ID in column A
  const find = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: 'Applications!A:A',
  });

  const values = find.data.values ?? [];
  let targetRowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i]?.[0] === applicationId) {
      targetRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (targetRowIndex > 0) {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `Applications!A${targetRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [rowData] },
    });
  } else {
    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: sid,
      range: 'Applications!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });
  }
}

// ─── Calculate next retry time with exponential backoff + jitter ───────────────

function nextAttemptAt(attempts: number): string {
  const base = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts), MAX_BACKOFF_MS);
  const jitter = Math.random() * 0.3 * base;
  return new Date(Date.now() + base + jitter).toISOString();
}

// ─── Process outbox ───────────────────────────────────────────────────────────

let syncRunning = false;

export async function processSheetsOutbox(): Promise<void> {
  if (syncRunning) return;
  syncRunning = true;

  const webhookUrl = getWebhookUrl();
  const client = getSheetsClient();

  if (!webhookUrl && !client) {
    syncRunning = false;
    return; // Sheets not configured — skipped, records remain safely queued in SQL
  }

  try {
    if (client) {
      await ensureHeaderRow(client.sheets, client.spreadsheetId);
    }

    const pending = getAll<SheetsSyncRow>(`
      SELECT so.*
      FROM recruitment_sheets_outbox so
      WHERE so.state = 'pending'
        AND so.next_attempt_at <= datetime('now')
        AND so.attempts < ?
      ORDER BY so.created_at ASC
      LIMIT ?
    `, [MAX_RETRIES, BATCH_SIZE]);

    for (const item of pending) {
      const app = getOne<ApplicationRow>(
        `SELECT * FROM recruitment_applications WHERE id = ?`,
        [item.application_id],
      );
      if (!app) {
        // Application deleted; remove from outbox
        runQuery(`DELETE FROM recruitment_sheets_outbox WHERE id = ?`, [item.id]);
        continue;
      }

      const hasFile = Boolean(getOne(
        `SELECT 1 FROM recruitment_application_files WHERE application_id = ?`,
        [app.id],
      ));

      const rowData = buildRow(app, hasFile);
      const ts = new Date().toISOString();

      try {
        if (client) {
          await upsertRow(client.sheets, client.spreadsheetId, rowData, app.id);
        } else if (webhookUrl) {
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'upsert',
              applicationId: app.id,
              columns: COLUMNS,
              row: rowData,
            }),
            redirect: 'follow',
          });
          if (!resp.ok) {
            throw new Error(`Webhook responded with HTTP ${resp.status}`);
          }
        }

        runQuery(`
          UPDATE recruitment_sheets_outbox
          SET state = 'synced', synced_at = ?, updated_at = ?, last_attempt_at = ?,
              attempts = attempts + 1, last_error = NULL
          WHERE id = ?
        `, [ts, ts, ts, item.id]);

        console.info(`[sheets] synced application ${app.id}`);
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const newAttempts = item.attempts + 1;
        const failed = newAttempts >= MAX_RETRIES;

        runQuery(`
          UPDATE recruitment_sheets_outbox
          SET attempts = ?, last_attempt_at = ?, updated_at = ?,
              next_attempt_at = ?, last_error = ?,
              state = CASE WHEN ? THEN 'failed' ELSE 'pending' END
          WHERE id = ?
        `, [
          newAttempts, ts, ts,
          nextAttemptAt(newAttempts),
          errMsg.slice(0, 500),
          failed ? 1 : 0,
          item.id,
        ]);

        console.error(`[sheets] sync failed for ${app.id} (attempt ${newAttempts})`, errMsg);
      }
    }
  } catch (e) {
    console.error('[sheets] outbox processing error', e);
  } finally {
    syncRunning = false;
  }
}

// ─── Reconciliation: compare SQL vs Sheets ─────────────────────────────────────

export async function reconcileSheets(): Promise<{ fixed: number; errors: number }> {
  const client = getSheetsClient();
  const webhookUrl = getWebhookUrl();
  if (!client && !webhookUrl) return { fixed: 0, errors: 0 };

  let fixed = 0;
  let errors = 0;

  try {
    const sheetIds = new Set<string>();

    if (client) {
      // Get all IDs in Sheets column A
      const res = await client.sheets.spreadsheets.values.get({
        spreadsheetId: client.spreadsheetId,
        range: 'Applications!A:A',
      });
      for (const r of (res.data.values ?? []).slice(1)) {
        if (r[0]) sheetIds.add(String(r[0]));
      }
    }

    // Get all IDs in SQL
    const sqlApps = getAll<{ id: string }>(
      `SELECT id FROM recruitment_applications ORDER BY submitted_at ASC`,
    );

    for (const { id } of sqlApps) {
      if (!sheetIds.has(id)) {
        // Missing from sheet — re-queue
        const ts = new Date().toISOString();
        runQuery(`
          INSERT INTO recruitment_sheets_outbox
            (application_id, idempotency_key, state, next_attempt_at, created_at, updated_at)
          VALUES (?,?,?,?,?,?)
          ON CONFLICT(idempotency_key) DO UPDATE
          SET state = 'pending', next_attempt_at = ?, updated_at = ?
        `, [id, `sync:${id}`, 'pending', ts, ts, ts, ts, ts]);
        fixed++;
      }
    }
  } catch (e) {
    console.error('[sheets] reconciliation error', e);
    errors++;
  }

  return { fixed, errors };
}
