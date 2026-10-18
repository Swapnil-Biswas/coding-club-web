"use client";

import { useState, useEffect, useCallback } from "react";
import { api, downloadFile } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isCoreHeadPlus } from "@/app/lib/roles";
import { formatDate, formatDateTime } from "@/app/lib/format";
import { Spinner, EmptyState, Modal, FormError, FormSuccess } from "@/app/components/app/ui";
import { TeamIcon } from "@/app/components/app/RecruitmentIcons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CycleDetail {
  cycle: {
    id: string;
    title: string;
    is_open: boolean;
    opened_at: string | null;
    closed_at: string | null;
    opened_by_name: string | null;
    closed_by_name: string | null;
    announcement_version: number;
  };
  stats: {
    total: number;
    submitted: number;
    under_review: number;
    shortlisted: number;
    selected: number;
  };
  sync_health: {
    total_applications: number;
    synced: number;
    pending: number;
    failed: number;
    last_synced_at: string | null;
  };
}

interface ApplicationSummary {
  id: string;
  cycle_id: string;
  status: string;
  full_name: string;
  email: string;
  college_email: string;
  usn: string;
  year_of_study: string;
  branch: string;
  selected_team: string;
  submitted_at: string;
  sync_state: string | null;
}

interface ApplicationDetail {
  id: string;
  status: string;
  full_name: string;
  email: string;
  college_email: string;
  phone: string;
  usn: string;
  year_of_study: string;
  branch: string;
  selected_team: string;
  clubs_orgs: string;
  why_join: string;
  weekly_hours: string;
  team_responses: Record<string, unknown>;
  submitted_at: string;
  files: Array<{ id: string; original_name: string; mime_type: string; size_bytes: number }>;
  status_history: Array<{ id: number; old_status: string; new_status: string; actor_id: number | null; reason: string; changed_at: string }>;
}

const TEAM_LABELS: Record<string, string> = {
  design: "Design",
  marketing: "Marketing",
  events_ops: "Events & Operations",
  technical: "Technical",
  outreach_sponsorship: "Outreach & Sponsorship",
};

const STATUS_OPTIONS = [
  "submitted", "under_review", "shortlisted",
  "interview_scheduled", "selected", "rejected", "waitlisted", "withdrawn",
];

function StatusPill({ status }: { status: string }) {
  const isSelected = status === "selected";
  const isShortlisted = status === "shortlisted";
  const isRejected = status === "rejected";
  const isReview = status === "under_review" || status === "interview_scheduled";

  const bg = isSelected ? "rgba(0,160,96,0.08)" : isShortlisted ? "rgba(99,102,241,0.08)" : isRejected ? "rgba(239,68,68,0.08)" : isReview ? "rgba(245,158,11,0.08)" : "var(--grey-100)";
  const color = isSelected ? "#008751" : isShortlisted ? "#4f46e5" : isRejected ? "#dc2626" : isReview ? "#b45309" : "var(--grey-600)";
  const border = isSelected ? "rgba(0,160,96,0.2)" : isShortlisted ? "rgba(99,102,241,0.2)" : isRejected ? "rgba(239,68,68,0.2)" : isReview ? "rgba(245,158,11,0.2)" : "var(--grey-200)";

  return (
    <span style={{
      display: "inline-block",
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      padding: "3px 9px",
      borderRadius: 100,
      background: bg,
      color: color,
      border: `1px solid ${border}`,
      whiteSpace: "nowrap",
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SyncDot({ state }: { state: string | null }) {
  const color = state === "synced" ? "#00a060" : state === "failed" ? "#ef4444" : "#f59e0b";
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
        flexShrink: 0,
      }}
      aria-label={`Sync: ${state ?? "pending"}`}
    />
  );
}

// ─── Admin Recruitment Management Panel ───────────────────────────────────────

export default function RecruitmentAdminPanel() {
  const { user } = useAuth();
  const canManage = isCoreHeadPlus(user);

  const [cycle, setCycle] = useState<CycleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"open" | "close" | null>(null);

  // Applications list
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterTeam, setFilterTeam] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<ApplicationDetail | null>(null);
  const [appDetailLoading, setAppDetailLoading] = useState(false);

  // Status update
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchCycle = useCallback(async () => {
    try {
      const data = await api<CycleDetail>("/recruitment/admin/cycle");
      setCycle(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load cycle");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(filterTeam ? { team: filterTeam } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterSearch ? { search: filterSearch } : {}),
      });
      const data = await api<{ applications: ApplicationSummary[]; total: number }>(
        `/recruitment/admin/applications?${params}`
      );
      setApplications(data.applications);
      setTotal(data.total);
    } catch { /* errors surfaced in fetch */ } finally {
      setAppsLoading(false);
    }
  }, [page, filterTeam, filterStatus, filterSearch]);

  useEffect(() => { fetchCycle(); }, [fetchCycle]);
  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  async function handleToggle(action: "open" | "close") {
    setActionLoading(true);
    setError(null);
    try {
      await api(`/recruitment/admin/${action}`, { method: "POST" });
      await fetchCycle();
      setConfirm(null);
      setMsg(`Recruitment has been successfully ${action === "open" ? "opened" : "closed"}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to ${action} recruitment`);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRetrySync() {
    try {
      await api("/recruitment/admin/sync-retry", { method: "POST" });
      await fetchCycle();
      setMsg("Failed items re-queued for sync.");
    } catch { /* ignore */ }
  }

  async function handleReconcile() {
    try {
      await api("/recruitment/admin/reconcile", { method: "POST" });
      await fetchCycle();
      setMsg("Reconciliation completed.");
    } catch { /* ignore */ }
  }

  async function handleExportCsv() {
    try {
      await downloadFile("/recruitment/admin/export/csv", "recruitment-applications.csv");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function loadAppDetail(id: string) {
    setAppDetailLoading(true);
    try {
      const data = await api<{ application: ApplicationDetail }>(`/recruitment/admin/applications/${id}`);
      setSelectedApp(data.application);
      setNewStatus(data.application.status);
      setStatusReason("");
    } catch { /* ignore */ } finally {
      setAppDetailLoading(false);
    }
  }

  async function handleStatusUpdate() {
    if (!selectedApp || !newStatus) return;
    setStatusUpdating(true);
    try {
      await api(`/recruitment/admin/applications/${selectedApp.id}/status`, {
        method: "PATCH",
        body: { status: newStatus, reason: statusReason },
      });
      await loadAppDetail(selectedApp.id);
      await fetchApplications();
      setMsg("Status updated successfully.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setStatusUpdating(false);
    }
  }

  if (!canManage) {
    return (
      <EmptyState
        title="Restricted Access"
        body="You need to be a Core Head or an authorized Admin to manage recruitment."
      />
    );
  }

  if (loading) {
    return <Spinner label="Loading recruitment data" />;
  }

  return (
    <div className="stack-lg">
      <FormError>{error}</FormError>
      <FormSuccess>{msg}</FormSuccess>

      {/* ── Cycle Status Card ────────────────────────────────────── */}
      {cycle && (
        <div className="card" style={{ padding: 24 }}>
          <div className="split">
            <div>
              <div className="cluster" style={{ gap: 10 }}>
                <h3 className="card-title" style={{ fontSize: 18 }}>{cycle.cycle.title}</h3>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  padding: "4px 12px",
                  borderRadius: 100,
                  background: cycle.cycle.is_open ? "rgba(0,160,96,0.08)" : "var(--grey-100)",
                  color: cycle.cycle.is_open ? "#008751" : "var(--grey-600)",
                  border: `1px solid ${cycle.cycle.is_open ? "rgba(0,160,96,0.25)" : "var(--grey-200)"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: cycle.cycle.is_open ? "#00a060" : "var(--grey-400)",
                  }} />
                  {cycle.cycle.is_open ? "OPEN" : "CLOSED"}
                </span>
              </div>
              <p className="card-muted" style={{ marginTop: 8, fontSize: 13.5 }}>
                {cycle.cycle.is_open
                  ? "Recruitment is currently LIVE. The announcement banner is showing on the website, the navigation link is visible, and applications are being accepted."
                  : "Recruitment is currently CLOSED. The navigation link and announcement banner are hidden from public view, and all new submissions are blocked."}
              </p>
              <div className="text-mono text-sm text-muted" style={{ marginTop: 8, fontSize: 11.5 }}>
                {cycle.cycle.is_open && cycle.cycle.opened_by_name && (
                  <span>Opened by <strong>{cycle.cycle.opened_by_name}</strong> on {formatDate(cycle.cycle.opened_at)}</span>
                )}
                {!cycle.cycle.is_open && cycle.cycle.closed_by_name && (
                  <span>Closed by <strong>{cycle.cycle.closed_by_name}</strong> on {formatDate(cycle.cycle.closed_at)}</span>
                )}
              </div>
            </div>

            <div>
              <button
                className={cycle.cycle.is_open ? "btn-danger btn-sm" : "btn-primary btn-sm"}
                onClick={() => setConfirm(cycle.cycle.is_open ? "close" : "open")}
                id={`rec-admin-toggle-${cycle.cycle.is_open ? "close" : "open"}`}
              >
                {cycle.cycle.is_open ? "Close Recruitment" : "Open Recruitment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Grid ───────────────────────────────────────────── */}
      {cycle && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-num">{cycle.stats.total}</div>
            <div className="stat-card-label">Total Applicants</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-num">{cycle.stats.submitted}</div>
            <div className="stat-card-label">Submitted</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-num">{cycle.stats.under_review}</div>
            <div className="stat-card-label">In Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-num">{cycle.stats.shortlisted}</div>
            <div className="stat-card-label">Shortlisted</div>
          </div>
        </div>
      )}

      {/* ── Google Sheets Sync Health ──────────────────────────────── */}
      {cycle && (
        <div className="card" style={{ padding: 22 }}>
          <div className="split">
            <div>
              <div className="cluster" style={{ gap: 8 }}>
                <span className="text-mono" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--grey-400)" }}>
                  Google Sheets Backup &amp; Sync Health
                </span>
              </div>
              <div className="cluster" style={{ gap: 20, marginTop: 10 }}>
                <div className="cluster" style={{ gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00a060" }} />
                  <span style={{ fontSize: 13, color: "var(--grey-700)" }}>Synced: <strong style={{ color: "var(--grey-900)" }}>{cycle.sync_health.synced}</strong></span>
                </div>
                <div className="cluster" style={{ gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                  <span style={{ fontSize: 13, color: "var(--grey-700)" }}>Pending: <strong style={{ color: "var(--grey-900)" }}>{cycle.sync_health.pending}</strong></span>
                </div>
                <div className="cluster" style={{ gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                  <span style={{ fontSize: 13, color: "var(--grey-700)" }}>Failed: <strong style={{ color: "var(--grey-900)" }}>{cycle.sync_health.failed}</strong></span>
                </div>
                {cycle.sync_health.last_synced_at && (
                  <span className="text-mono text-sm text-muted">
                    Last sync: {formatDateTime(cycle.sync_health.last_synced_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="cluster" style={{ gap: 8 }}>
              {cycle.sync_health.failed > 0 && (
                <button className="btn-secondary btn-sm" onClick={handleRetrySync} id="rec-admin-retry-sync">
                  Retry Failed ({cycle.sync_health.failed})
                </button>
              )}
              <button className="btn-secondary btn-sm" onClick={handleReconcile} id="rec-admin-reconcile">
                Reconcile Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Applications Table Card ───────────────────────────────── */}
      <div className="card" style={{ padding: 24 }}>
        <div className="split" style={{ marginBottom: 18 }}>
          <div>
            <h3 className="card-title" style={{ fontSize: 18 }}>Applications</h3>
            <p className="card-muted" style={{ marginTop: 2 }}>{total} total applications in this cycle</p>
          </div>
          <button className="btn-secondary btn-sm" onClick={handleExportCsv} id="rec-admin-export-csv">
            ↓ Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="cluster" style={{ gap: 10, marginBottom: 18 }}>
          <input
            type="search"
            className="input"
            style={{ maxWidth: 260, padding: "8px 14px", fontSize: 13 }}
            placeholder="Search name, email, USN…"
            value={filterSearch}
            onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
            id="rec-admin-search"
          />
          <select
            className="select"
            style={{ maxWidth: 200, padding: "8px 14px", fontSize: 13 }}
            value={filterTeam}
            onChange={(e) => { setFilterTeam(e.target.value); setPage(1); }}
            id="rec-admin-filter-team"
          >
            <option value="">All Teams</option>
            {Object.entries(TEAM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            className="select"
            style={{ maxWidth: 180, padding: "8px 14px", fontSize: 13 }}
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            id="rec-admin-filter-status"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </div>

        {appsLoading ? (
          <Spinner label="Loading applications" />
        ) : applications.length === 0 ? (
          <EmptyState title="No applications found" body="Try adjusting your filters or search keywords." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Team</th>
                  <th>Year / Branch</th>
                  <th>USN</th>
                  <th>Status</th>
                  <th>Sync</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--grey-900)" }}>{a.full_name}</div>
                      <div className="text-mono text-sm text-muted">{a.college_email}</div>
                    </td>
                    <td>
                      <span className="cluster" style={{ gap: 7 }}>
                        <span style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: "var(--grey-100)",
                          border: "1px solid var(--grey-200)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--grey-700)",
                          flexShrink: 0,
                        }}>
                          <TeamIcon team={a.selected_team} size={12} />
                        </span>
                        <span style={{ fontWeight: 600, color: "var(--grey-800)" }}>
                          {TEAM_LABELS[a.selected_team] ?? a.selected_team}
                        </span>
                      </span>
                    </td>
                    <td className="text-sm">
                      {a.year_of_study} <span className="text-muted">· {a.branch}</span>
                    </td>
                    <td className="text-mono text-sm" style={{ fontWeight: 500 }}>{a.usn}</td>
                    <td><StatusPill status={a.status} /></td>
                    <td>
                      <span className="cluster" style={{ gap: 4 }}>
                        <SyncDot state={a.sync_state} />
                        <span className="text-mono text-sm text-muted" style={{ fontSize: 11 }}>{a.sync_state ?? "pending"}</span>
                      </span>
                    </td>
                    <td className="text-mono text-sm text-muted">
                      {formatDate(a.submitted_at)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => loadAppDetail(a.id)}
                          id={`rec-admin-view-${a.id}`}
                        >
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 25 && (
          <div className="split" style={{ marginTop: 18 }}>
            <span className="text-mono text-sm text-muted">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
            </span>
            <div className="cluster" style={{ gap: 6 }}>
              <button
                className="btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={page * 25 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Toggle Open/Close Confirmation Modal ──────────────────── */}
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === "open" ? "Open Recruitment Drive?" : "Close Recruitment Drive?"}
        eyebrow="// Recruitment State Change"
      >
        <p className="card-muted" style={{ marginBottom: 20, fontSize: 14 }}>
          {confirm === "open"
            ? "Opening recruitment will display the 'Recruitments' link in the top navigation, show the announcement banner to all website visitors, and begin accepting applications at /recruitment."
            : "Closing recruitment will immediately hide the navigation link, dismiss the public banner, and block any new application submissions. All existing applications and reviews will remain safely preserved in the database."}
        </p>
        <div className="cluster cluster-end" style={{ gap: 10 }}>
          <button className="btn-secondary btn-sm" onClick={() => setConfirm(null)} disabled={actionLoading}>
            Cancel
          </button>
          <button
            className={confirm === "close" ? "btn-danger btn-sm" : "btn-primary btn-sm"}
            onClick={() => confirm && handleToggle(confirm)}
            disabled={actionLoading}
            id={`rec-admin-confirm-${confirm}`}
          >
            {actionLoading ? "Updating…" : confirm === "close" ? "Yes, Close Recruitment" : "Yes, Open Recruitment"}
          </button>
        </div>
      </Modal>

      {/* ── Application Detail Modal ──────────────────────────────── */}
      <Modal
        open={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
        large={true}
        eyebrow="// Application Review"
        title={selectedApp ? selectedApp.full_name : ""}
        sub={selectedApp ? `${TEAM_LABELS[selectedApp.selected_team] ?? selectedApp.selected_team} · USN: ${selectedApp.usn} · ${selectedApp.year_of_study}` : ""}
      >
        {selectedApp && (
          <div className="stack" style={{ gap: 24, marginTop: 16 }}>
            {/* Applicant Profile Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, background: "var(--grey-50)", padding: 18, borderRadius: 12, border: "1px solid var(--grey-100)" }}>
              <div>
                <span className="field-label" style={{ fontSize: 10 }}>Personal Email</span>
                <div className="text-mono text-sm" style={{ fontWeight: 600, color: "var(--grey-900)" }}>{selectedApp.email}</div>
              </div>
              <div>
                <span className="field-label" style={{ fontSize: 10 }}>College Email</span>
                <div className="text-mono text-sm" style={{ fontWeight: 600, color: "var(--grey-900)" }}>{selectedApp.college_email}</div>
              </div>
              <div>
                <span className="field-label" style={{ fontSize: 10 }}>Phone</span>
                <div className="text-mono text-sm" style={{ fontWeight: 600, color: "var(--grey-900)" }}>{selectedApp.phone}</div>
              </div>
              <div>
                <span className="field-label" style={{ fontSize: 10 }}>Branch</span>
                <div className="text-sm" style={{ fontWeight: 600, color: "var(--grey-900)" }}>{selectedApp.branch}</div>
              </div>
              <div>
                <span className="field-label" style={{ fontSize: 10 }}>Weekly Dedication</span>
                <div className="text-sm" style={{ fontWeight: 600, color: "var(--grey-900)" }}>{selectedApp.weekly_hours}</div>
              </div>
              <div>
                <span className="field-label" style={{ fontSize: 10 }}>Current Status</span>
                <div style={{ marginTop: 4 }}><StatusPill status={selectedApp.status} /></div>
              </div>
            </div>

            {/* General responses */}
            <div className="stack" style={{ gap: 14 }}>
              <div>
                <span className="field-label">Clubs / Student Organisations</span>
                <div style={{ background: "var(--white)", border: "1px solid var(--grey-200)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "var(--grey-800)", whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {selectedApp.clubs_orgs || "N/A"}
                </div>
              </div>

              <div>
                <span className="field-label">Why Join Coding Club?</span>
                <div style={{ background: "var(--white)", border: "1px solid var(--grey-200)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "var(--grey-800)", whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {selectedApp.why_join}
                </div>
              </div>
            </div>

            {/* Team-Specific Responses */}
            <div>
              <span className="field-label" style={{ fontSize: 11, marginBottom: 8, display: "block" }}>
                {TEAM_LABELS[selectedApp.selected_team] ?? selectedApp.selected_team} — Specific Answers
              </span>
              <div className="stack" style={{ gap: 12 }}>
                {Object.entries(selectedApp.team_responses).map(([k, v]) => {
                  if (k.startsWith("_")) return null;
                  const label = k.replace(/^(design_|marketing_|events_|tech_|outreach_)/, "").replace(/_/g, " ");
                  return (
                    <div key={k} style={{ background: "var(--white)", border: "1px solid var(--grey-100)", borderRadius: 10, padding: "12px 14px" }}>
                      <span className="text-mono text-sm text-muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>
                        {label}
                      </span>
                      <div style={{ fontSize: 13.5, color: "var(--grey-800)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {Array.isArray(v) ? v.join(", ") : String(v ?? "—")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Uploaded Files */}
            {selectedApp.files?.length > 0 && (
              <div>
                <span className="field-label" style={{ fontSize: 11, marginBottom: 8, display: "block" }}>Uploaded Files</span>
                <div className="stack" style={{ gap: 8 }}>
                  {selectedApp.files.map((f) => (
                    <div key={f.id} className="split" style={{ background: "var(--grey-50)", border: "1px solid var(--grey-100)", borderRadius: 10, padding: "10px 14px" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--grey-900)" }}>{f.original_name}</div>
                        <div className="text-mono text-sm text-muted" style={{ fontSize: 11 }}>{(f.size_bytes / 1024 / 1024).toFixed(2)} MB · {f.mime_type}</div>
                      </div>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => downloadFile(`/recruitment/admin/files/${f.id}`, f.original_name)}
                      >
                        ↓ Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Update Card */}
            <div style={{ background: "var(--grey-50)", border: "1px solid var(--grey-200)", borderRadius: 12, padding: 18 }}>
              <span className="field-label" style={{ marginBottom: 12, display: "block" }}>Update Candidate Status</span>
              <div className="cluster" style={{ gap: 12, alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label className="text-sm text-muted" style={{ display: "block", marginBottom: 4 }}>New Status</label>
                  <select
                    className="select"
                    style={{ padding: "8px 12px", fontSize: 13 }}
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2, minWidth: 220 }}>
                  <label className="text-sm text-muted" style={{ display: "block", marginBottom: 4 }}>Reason / Internal Note (optional)</label>
                  <input
                    type="text"
                    className="input"
                    style={{ padding: "8px 12px", fontSize: 13 }}
                    placeholder="E.g. Strong portfolio; scheduled technical interview"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                  />
                </div>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleStatusUpdate}
                  disabled={statusUpdating}
                  style={{ height: 38 }}
                >
                  {statusUpdating ? "Saving…" : "Save Status"}
                </button>
              </div>
            </div>

            {/* Status History */}
            {selectedApp.status_history?.length > 0 && (
              <div>
                <span className="field-label" style={{ marginBottom: 8, display: "block" }}>Status Audit History</span>
                <div className="stack" style={{ gap: 6 }}>
                  {[...selectedApp.status_history].reverse().map((h) => (
                    <div key={h.id} className="split" style={{ fontSize: 12, padding: "8px 12px", background: "var(--white)", border: "1px solid var(--grey-100)", borderRadius: 8 }}>
                      <span className="cluster" style={{ gap: 6 }}>
                        <span style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-500)" }}>{h.old_status}</span>
                        <span>→</span>
                        <strong style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-800)" }}>{h.new_status}</strong>
                        {h.reason && <span className="text-muted">"{h.reason}"</span>}
                      </span>
                      <span className="text-mono text-sm text-muted">{formatDateTime(h.changed_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
