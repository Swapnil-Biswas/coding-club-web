"use client";

import { useEffect, useState } from "react";
import { api, assetUrl } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isCoreHeadPlus, isAdmin, isPresident, isFaculty } from "@/app/lib/roles";
import type {
  AnalyticsOverview,
  ActivityLogEntry,
  JoinRequest,
  Sponsor,
  Team,
  AdminUser,
  PublicUser,
  ClubEvent,
  CertificateTemplate,
  Project,
  ProjectCategory,
  ProjectStatus,
  Mentor,
  Photo,
  BuilderRepo,
  BuilderRepoStatus,
} from "@/app/lib/types";
import { formatDate, formatDateTime, certTypeLabel } from "@/app/lib/format";
import ImageSourceInput from "@/app/components/app/ImageSourceInput";
import {
  PageHeader,
  Spinner,
  EmptyState,
  Tabs,
  Badge,
  FormError,
  FormSuccess,
  Modal,
  Field,
  RoleChip,
} from "@/app/components/app/ui";

export default function DashboardPage() {
  const { user, ready, openAuth } = useAuth();

  if (!ready) {
    return <div className="page"><div className="section-inner"><Spinner /></div></div>;
  }
  if (!user) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Sign in required" body="The dashboard is for Core Heads and admins." action={<button className="btn-primary" onClick={() => openAuth("login")}>Sign in</button>} />
      </div></div>
    );
  }
  if (!isCoreHeadPlus(user) && !isFaculty(user)) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Core Head access only" body="You need to be a Core Head, the President, or an admin to open the dashboard." />
      </div></div>
    );
  }

  // Faculty get a read-only analytics view — no management controls.
  if (isFaculty(user)) {
    return <FacultyAnalyticsView />;
  }

  return <DashboardInner />;
}

const TABS = [
  { id: "overview",  label: "Overview" },
  { id: "events",    label: "Events" },
  { id: "teams",     label: "Teams" },
  { id: "certificates", label: "Certificates" },
  { id: "gallery",   label: "Gallery" },
  { id: "sponsors",  label: "Partners" },
  { id: "requests",  label: "Join Requests" },
  { id: "content",   label: "About Page" },
  { id: "builders",  label: "Builders" },
  { id: "projects",  label: "Projects" },
  { id: "mentors",   label: "Mentors" },
  { id: "admin",     label: "Admin" },
];

/** Faculty see only the analytics overview — no management controls. */
function FacultyAnalyticsView() {
  return (
    <div className="page">
      <div className="section-inner section-inner-wide">
        <PageHeader
          eyebrow="// Faculty Observer"
          title="Analytics"
          ghost="overview."
          sub="You have read-only access to the club's analytics and event data."
        />
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
            padding: "8px 14px",
            borderRadius: 8,
            background: "rgba(180,120,0,0.08)",
            border: "1px solid rgba(180,120,0,0.2)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#a07800",
            letterSpacing: "0.07em",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a07800", display: "inline-block" }} />
          FACULTY OBSERVER — READ-ONLY ACCESS
        </div>
        <OverviewTab />
      </div>
    </div>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [tab, setTab] = useState("overview");

  const visibleTabs = TABS.filter((t) => {
    if (t.id === "admin" || t.id === "projects" || t.id === "mentors") return admin;
    return true;
  });

  return (
    <div className="page">
      <div className="section-inner section-inner-wide">
        <PageHeader
          eyebrow="// Dashboard"
          title={admin ? "Platform" : isPresident(user) ? "President" : "Core Head"}
          ghost="console."
          sub="Manage events, teams, certificates, partners, requests, and site content."
        />
        <Tabs active={tab} onChange={setTab} tabs={visibleTabs} />
        {tab === "overview" && <OverviewTab />}
        {tab === "events" && <EventsTab />}
        {tab === "teams" && <TeamsTab />}
        {tab === "certificates" && <CertificatesTab />}
        {tab === "gallery" && <GalleryTab />}
        {tab === "sponsors" && <SponsorsTab />}
        {tab === "requests" && <RequestsTab />}
        {tab === "content" && <ContentTab />}
        {tab === "builders" && <BuildersTab />}
        {tab === "projects" && admin && <ProjectsTab />}
        {tab === "mentors"  && admin && <MentorsTab />}
        {tab === "admin" && admin && <AdminTab />}
      </div>
    </div>
  );
}

/* ============================ OVERVIEW ============================ */
function OverviewTab() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const canSeeActivity = isAdmin(user) || isPresident(user);

  useEffect(() => {
    api<AnalyticsOverview>("/analytics").then(setData).catch(() => {});
    if (canSeeActivity) {
      api<ActivityLogEntry[] | { logs?: ActivityLogEntry[] }>("/activity-log?limit=12")
        .then((d) => setActivity(Array.isArray(d) ? d : d.logs || []))
        .catch(() => {});
    }
  }, [canSeeActivity]);

  if (!data) return <Spinner label="Loading analytics" />;
  const t = data.totals;
  const stats = [
    { label: "Members", value: t.total_users },
    { label: "Events", value: t.total_events },
    { label: "Registrants", value: t.total_registrants },
    { label: "Checked in", value: t.total_checked_in },
    { label: "Teams", value: t.total_teams },
    { label: "Certificates", value: t.total_certificates },
    { label: "History entries", value: t.total_history },
  ];
  const attendancePct = t.total_registrants ? Math.round((t.total_checked_in / t.total_registrants) * 100) : 0;

  return (
    <div className="stack-lg">
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card-num">{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-card-num">{attendancePct}%</div>
          <div className="stat-card-label">Attendance</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card" style={{ padding: 24 }}>
          <h3 className="card-title" style={{ fontSize: 17, marginBottom: 16 }}>Events by status</h3>
          <div className="stack" style={{ gap: 10 }}>
            {data.eventsByStatus.map((r) => (
              <div className="split" key={r.status}>
                <Badge variant={r.status === "published" ? "published" : r.status === "draft" ? "draft" : "completed"}>{r.status}</Badge>
                <span className="stat-card-num" style={{ fontSize: 22 }}>{r.count}</span>
              </div>
            ))}
            {data.eventsByStatus.length === 0 && <p className="card-muted">No events yet.</p>}
          </div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 className="card-title" style={{ fontSize: 17, marginBottom: 16 }}>Users by role</h3>
          <div className="stack" style={{ gap: 10 }}>
            {data.usersByRole.map((r) => (
              <div className="split" key={r.role}>
                <RoleChip role={r.role} />
                <span className="stat-card-num" style={{ fontSize: 22 }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 16 }}>Recent events</h3>
        <div className="stack" style={{ gap: 8 }}>
          {data.recentEvents.map((e) => (
            <div className="split" key={e.id} style={{ padding: "10px 14px", background: "var(--grey-50)", borderRadius: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</span>
              <span className="cluster" style={{ gap: 10 }}>
                <Badge variant={e.status === "published" ? "published" : e.status === "draft" ? "draft" : "completed"}>{e.status}</Badge>
                <span className="text-mono text-sm text-muted">{formatDate(e.start_datetime)}</span>
              </span>
            </div>
          ))}
          {data.recentEvents.length === 0 && <p className="card-muted">No events yet.</p>}
        </div>
      </div>

      {canSeeActivity && (
        <div className="card" style={{ padding: 24 }}>
          <h3 className="card-title" style={{ fontSize: 17, marginBottom: 16 }}>Recent activity</h3>
          <div className="stack" style={{ gap: 8 }}>
            {activity.map((a) => (
              <div key={a.id} className="split" style={{ padding: "10px 14px", background: "var(--grey-50)", borderRadius: 10 }}>
                <span style={{ fontSize: 13.5 }}>
                  <strong>{a.user_name || "System"}</strong> {a.action.toLowerCase()} <span className="text-muted">{a.entity}</span>
                </span>
                <span className="text-mono text-sm text-muted">{formatDateTime(a.timestamp)}</span>
              </div>
            ))}
            {activity.length === 0 && <p className="card-muted">No activity recorded yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ MENTORS ============================ */

const EMPTY_MENTOR_FORM = {
  name: "",
  photo_url: "",
  bio: "",
  current_role: "",
  organization: "",
  linkedin_url: "",
  github_url: "",
  whatsapp_number: "",
  is_active: true,
  sort_order: 0,
};

function MentorsTab() {
  const [mentors, setMentors]       = useState<Mentor[]>([]);
  const [busy, setBusy]             = useState(false);
  const [msg, setMsg]               = useState("");
  const [err, setErr]               = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<Mentor | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_MENTOR_FORM });
  const [photoFile, setPhotoFile]   = useState<File | null>(null);
  const [saveBusy, setSaveBusy]     = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Mentor | null>(null);

  async function load() {
    try {
      const d = await api<{ mentors: Mentor[] }>("/mentors/all");
      setMentors(d.mentors);
    } catch { /* silent */ }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_MENTOR_FORM });
    setPhotoFile(null);
    setErr(""); setMsg("");
    setModalOpen(true);
  }
  function openEdit(m: Mentor) {
    setEditing(m);
    setForm({
      name:           m.name,
      photo_url:      "",
      bio:            m.bio            || "",
      current_role:   m.current_role   || "",
      organization:   m.organization   || "",
      linkedin_url:   m.linkedin_url   || "",
      github_url:     m.github_url     || "",
      whatsapp_number: m.whatsapp_number || "",
      is_active:      m.is_active,
      sort_order:     m.sort_order,
    });
    setPhotoFile(null);
    setErr(""); setMsg("");
    setModalOpen(true);
  }

  async function save() {
    setErr("");
    setSaveBusy(true);
    try {
      const path = editing ? `/mentors/${editing.id}` : "/mentors";
      const method = editing ? "PATCH" : "POST";
      if (photoFile) {
        const body = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          body.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
        });
        body.append("photo", photoFile);
        await api(path, { method, body, isForm: true });
      } else {
        await api(path, { method, body: form });
      }
      setMsg(editing ? "Mentor updated." : "Mentor added.");
      setModalOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveBusy(false);
    }
  }

  async function doDeactivate(m: Mentor) {
    setBusy(true); setErr(""); setMsg(""); setDeactivateTarget(null);
    try {
      await api(`/mentors/${m.id}`, { method: "DELETE" });
      setMsg(`${m.name} deactivated.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally { setBusy(false); }
  }

  async function reactivate(m: Mentor) {
    setBusy(true); setErr(""); setMsg("");
    try {
      await api(`/mentors/${m.id}`, { method: "PATCH", body: { is_active: true } });
      setMsg(`${m.name} reactivated.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally { setBusy(false); }
  }

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="stack-lg">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Mentors Directory</div>
          <div style={{ fontSize: 14, color: "var(--grey-600)" }}>
            {mentors.filter((m) => m.is_active).length} active · {mentors.filter((m) => !m.is_active).length} inactive
          </div>
        </div>
        <button className="btn-primary btn-sm" onClick={openAdd}>+ Add Mentor</button>
      </div>

      <FormSuccess>{msg}</FormSuccess>
      <FormError>{err}</FormError>

      {mentors.length === 0 ? (
        <EmptyState title="No mentors yet" body="Add your first mentor using the button above." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role / Org</th>
                <th>Contacts</th>
                <th>Status</th>
                <th>Order</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mentors.map((m) => (
                <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600 }}>
                    {m.name}
                  </td>
                  <td className="text-sm text-muted">
                    {m.current_role && <span>{m.current_role}</span>}
                    {m.current_role && m.organization && <span> @ </span>}
                    {m.organization && <span style={{ fontWeight: 600, color: "var(--grey-700)" }}>{m.organization}</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {m.linkedin_url && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--grey-100)", color: "var(--grey-600)" }}>LI</span>}
                      {m.github_url   && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--grey-100)", color: "var(--grey-600)" }}>GH</span>}
                      {m.whatsapp_number && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(37,211,102,0.1)", color: "#128c4a" }}>WA</span>}
                      {!m.linkedin_url && !m.github_url && !m.whatsapp_number && <span className="text-sm text-muted">—</span>}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.is_active ? "#00a060" : "var(--grey-400)" }}>
                      {m.is_active ? "● Active" : "○ Inactive"}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{m.sort_order}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => openEdit(m)}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >Edit</button>
                      {m.is_active ? (
                        <button
                          className="btn-sm"
                          title={`Deactivate ${m.name}`}
                          disabled={busy}
                          onClick={() => setDeactivateTarget(m)}
                          style={{
                            background: "none", border: "1.5px solid rgba(192,57,43,0.3)",
                            borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                            color: "#c0392b", fontSize: 12, fontFamily: "var(--font-mono)",
                            opacity: busy ? 0.4 : 1,
                          }}
                        >Deactivate</button>
                      ) : (
                        <button
                          className="btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => reactivate(m)}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >Reactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <Modal
          open
          onClose={() => setModalOpen(false)}
          large
          title={editing ? `Edit — ${editing.name}` : "Add Mentor"}
          eyebrow="// Mentor profile"
          sub="Fields marked with * are required. Contact fields are only visible to Core members and above."
        >
          <div className="stack" style={{ gap: 14 }}>
            <FormError>{err}</FormError>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <Field label="Name *" required>
                <input id="mentor-name" className="input" value={form.name} onChange={f("name")} placeholder="e.g. Aarav Sharma" required />
              </Field>
              <Field label="Organization *">
                <input id="mentor-org" className="input" value={form.organization} onChange={f("organization")} placeholder="e.g. Microsoft" />
              </Field>
            </div>

            <Field label="Current Role">
              <input id="mentor-role" className="input" value={form.current_role} onChange={f("current_role")} placeholder="e.g. Software Engineer" />
            </Field>

            <Field label="Bio">
              <textarea
                id="mentor-bio"
                className="input"
                rows={3}
                value={form.bio}
                onChange={f("bio")}
                placeholder="e.g. BMSIT Coding Club alum (2021), now SDE at Microsoft working on Azure."
              />
            </Field>

            <Field label="Photo">
              <ImageSourceInput
                file={photoFile}
                url={form.photo_url}
                onFileChange={setPhotoFile}
                onUrlChange={(photo_url) => setForm((current) => ({ ...current, photo_url }))}
                onError={setErr}
                disabled={saveBusy}
              />
            </Field>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", letterSpacing: "0.1em", textTransform: "uppercase", paddingTop: 8, borderTop: "1px solid var(--grey-200)" }}>
              Contact Info — Core+ only
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <Field label="LinkedIn URL">
                <input id="mentor-linkedin" className="input" value={form.linkedin_url} onChange={f("linkedin_url")} placeholder="https://linkedin.com/in/…" />
              </Field>
              <Field label="GitHub URL">
                <input id="mentor-github" className="input" value={form.github_url} onChange={f("github_url")} placeholder="https://github.com/…" />
              </Field>
            </div>

            <Field label="WhatsApp Number">
              <input id="mentor-wa" className="input" value={form.whatsapp_number} onChange={f("whatsapp_number")} placeholder="91XXXXXXXXXX (with country code, digits only)" />
            </Field>

            <div className="grid grid-2" style={{ gap: 12 }}>
              <Field label="Sort Order">
                <input id="mentor-order" className="input" type="number" value={form.sort_order} onChange={f("sort_order")} placeholder="0" />
              </Field>
              <Field label="Active">
                <select
                  id="mentor-active"
                  className="input"
                  value={form.is_active ? "1" : "0"}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === "1" }))}
                >
                  <option value="1">Yes — show on public page</option>
                  <option value="0">No — hidden from public</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="btn-secondary btn-block" onClick={() => setModalOpen(false)} disabled={saveBusy}>Cancel</button>
              <button className="btn-primary btn-block" onClick={save} disabled={saveBusy} style={{ fontWeight: 700 }}>
                {saveBusy ? "Saving…" : editing ? "Save changes" : "Add mentor"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Deactivate confirmation */}
      {deactivateTarget && (
        <div className="modal-overlay" onClick={() => setDeactivateTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: "50%", background: "rgba(192,57,43,0.1)", color: "#c0392b" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <h2 className="modal-title" style={{ textAlign: "center", fontSize: 20, marginBottom: 8 }}>Deactivate mentor?</h2>
            <p className="modal-sub" style={{ textAlign: "center", marginBottom: 20 }}>
              <strong>{deactivateTarget.name}</strong> will be hidden from the public mentors page. You can reactivate them at any time.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary btn-block" onClick={() => setDeactivateTarget(null)}>Cancel</button>
              <button className="btn-danger btn-block" style={{ fontWeight: 700 }} onClick={() => doDeactivate(deactivateTarget)}>Yes, deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ============================ EVENTS ============================ */
function EventsTab() {
  const [events, setEvents] = useState<ClubEvent[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await api<{ events: ClubEvent[] }>("/events");
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    }
  }
  useEffect(() => { load(); }, []);

  async function save(ev: ClubEvent, patch: Partial<ClubEvent>) {
    setError(""); setMsg("");
    try {
      await api(`/events/${ev.id}`, { method: "PATCH", body: patch });
      setMsg(`"${ev.title}" updated.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      throw err;
    }
  }

  async function remove(ev: ClubEvent) {
    if (!confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    setError(""); setMsg("");
    try {
      await api(`/events/${ev.id}`, { method: "DELETE" });
      setMsg(`"${ev.title}" deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="stack-lg">
      <div className="split">
        <FormError>{error}</FormError>
        <FormSuccess>{msg}</FormSuccess>
        <span />
        <button className="btn-primary" onClick={() => setCreating(true)}>+ New event</button>
      </div>

      {events === null && !error && <Spinner label="Loading events" />}
      {events && events.length === 0 && <EmptyState title="No events yet" body="Create your first event to get started." />}

      {events && events.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Event</th><th>Date</th><th>Visibility</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600, color: "var(--grey-900)", maxWidth: 240 }}>{ev.title}</td>
                  <td className="text-sm text-muted">{formatDate(ev.start_datetime)}</td>
                  <td className="text-sm">{ev.visibility === "member_only" ? "Members" : "Public"}</td>
                  <td><Badge variant={ev.status === "published" ? "published" : ev.status === "draft" ? "draft" : "completed"}>{ev.status}</Badge></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-secondary btn-sm" onClick={() => setEditing(ev)}>Edit</button>
                      {ev.status === "draft" && (
                        <button className="btn-secondary btn-sm" onClick={() => save(ev, { status: "published" }).catch(() => {})}>Publish</button>
                      )}
                      {ev.status === "published" && (
                        <button className="btn-secondary btn-sm" onClick={() => save(ev, { status: "completed" }).catch(() => {})}>Complete</button>
                      )}
                      <a className="btn-ghost btn-sm" href={`/events/${ev.id}/manage`}>Manage</a>
                      <button className="btn-danger btn-sm" onClick={() => remove(ev)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EventFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={async () => { setCreating(false); await load(); }}
      />
      <EventFormModal
        open={!!editing}
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await load(); }}
      />
    </div>
  );
}

function EventFormModal({
  open,
  onClose,
  onSaved,
  event,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  event?: ClubEvent | null;
}) {
  const isEdit = !!event;
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_datetime: "",
    end_datetime: "",
    venue: "",
    category: "",
    visibility: "public",
    unstop_link: "",
  });
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setBannerFile(null);
      setBannerUrl("");
      setForm(
        event
          ? {
              title: event.title,
              description: event.description,
              start_datetime: toLocalInput(event.start_datetime),
              end_datetime: toLocalInput(event.end_datetime),
              venue: event.venue,
              category: event.category,
              visibility: event.visibility,
              unstop_link: event.unstop_link || "",
            }
          : { title: "", description: "", start_datetime: "", end_datetime: "", venue: "", category: "", visibility: "public", unstop_link: "" },
      );
    }
  }, [open, event]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: new Date(form.end_datetime).toISOString(),
        venue: form.venue.trim(),
        category: form.category.trim(),
        visibility: form.visibility,
        unstop_link: form.unstop_link.trim() || null,
      };
      let savedEvent: ClubEvent;
      if (isEdit && event) {
        const result = await api<{ event: ClubEvent }>(`/events/${event.id}`, { method: "PATCH", body });
        savedEvent = result.event;
      } else {
        const result = await api<{ event: ClubEvent }>("/events", { method: "POST", body });
        savedEvent = result.event;
      }
      if (bannerFile) {
        const bannerBody = new FormData();
        bannerBody.append("banner", bannerFile);
        await api(`/events/${savedEvent.id}/banner`, { method: "POST", body: bannerBody, isForm: true });
      } else if (bannerUrl.trim()) {
        await api(`/events/${savedEvent.id}/banner`, {
          method: "POST",
          body: { banner_image_url: bannerUrl.trim() },
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} large title={isEdit ? "Edit event" : "New event"} eyebrow="// Event" sub="Fill in the details. Publish from the events list when ready.">
      <form onSubmit={submit}>
        <FormError>{error}</FormError>
        <Field label="Title" required>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </Field>
        <Field label="Description">
          <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Starts" required>
            <input className="input" type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} required />
          </Field>
          <Field label="Ends" required>
            <input className="input" type="datetime-local" value={form.end_datetime} onChange={(e) => setForm({ ...form, end_datetime: e.target.value })} required />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Venue">
            <input className="input" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Seminar Hall B" />
          </Field>
          <Field label="Category">
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Hackathon" />
          </Field>
        </div>
        <Field label="Banner image" hint={event?.banner_image_url ? "Leave empty to keep the current banner." : undefined}>
          <ImageSourceInput
            file={bannerFile}
            url={bannerUrl}
            onFileChange={setBannerFile}
            onUrlChange={setBannerUrl}
            onError={setError}
            disabled={busy}
          />
        </Field>
        <div className="form-row">
          <Field label="Visibility" required>
            <select className="select" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="public">Public</option>
              <option value="member_only">Members only</option>
            </select>
          </Field>
          <Field label="Registration link" hint="Optional — any platform (Unstop, Devfolio, Google Forms, etc.)">
            <input className="input" value={form.unstop_link} onChange={(e) => setForm({ ...form, unstop_link: e.target.value })} placeholder="https://…" />
          </Field>
        </div>
        <button className="btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create event"}
        </button>
      </form>
    </Modal>
  );
}

function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ============================ TEAMS ============================ */
function TeamsTab() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "", logo_url: "" });
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<Team | null>(null);

  async function load() {
    try {
      const data = await api<{ teams: Team[] }>("/teams");
      setTeams(data.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    }
  }
  useEffect(() => {
    load();
    api<{ users: AdminUser[] }>("/users").then((d) => setUsers(d.users)).catch(() => {});
  }, []);

  const coreUsers = users.filter((u) => ["core", "core_head", "admin"].includes(u.role));

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    try {
      if (teamLogoFile) {
        const body = new FormData();
        body.append("name", newTeam.name);
        body.append("description", newTeam.description);
        body.append("logo", teamLogoFile);
        await api("/teams", { method: "POST", body, isForm: true });
      } else {
        await api("/teams", { method: "POST", body: newTeam });
      }
      setMsg(`Team "${newTeam.name}" created.`);
      setNewTeam({ name: "", description: "", logo_url: "" });
      setTeamLogoFile(null);
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function removeTeam(t: Team) {
    if (!confirm(`Delete team "${t.name}"?`)) return;
    setError("");
    try {
      await api(`/teams/${t.id}`, { method: "DELETE" });
      setMsg(`Team deleted.`);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="stack-lg">
      <div className="split">
        <FormError>{error}</FormError>
        <FormSuccess>{msg}</FormSuccess>
        <span />
        <button className="btn-primary" onClick={() => setCreating(!creating)}>{creating ? "Cancel" : "+ New team"}</button>
      </div>

      {creating && (
        <form className="card" onSubmit={createTeam} style={{ padding: 24 }}>
          <h3 className="card-title" style={{ fontSize: 17, marginBottom: 16 }}>Create a team</h3>
          <div className="form-row">
            <Field label="Team name" required>
              <input className="input" value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} required />
            </Field>
            <Field label="Logo">
              <ImageSourceInput
                file={teamLogoFile}
                url={newTeam.logo_url}
                onFileChange={setTeamLogoFile}
                onUrlChange={(logo_url) => setNewTeam((current) => ({ ...current, logo_url }))}
                onError={setError}
              />
            </Field>
          </div>
          <Field label="Description" required>
            <textarea className="textarea" value={newTeam.description} onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })} required />
          </Field>
          <button className="btn-primary btn-sm" type="submit">Create team</button>
        </form>
      )}

      {teams === null && !error && <Spinner label="Loading teams" />}
      {teams && teams.length === 0 && <EmptyState title="No teams yet" body="Create a team to get started." />}

      {teams && teams.length > 0 && (
        <div className="grid grid-2">
          {teams.map((t) => (
            <div key={t.id} className="card card-hover" style={{ padding: 22 }}>
              <div className="split split-start">
                <div className="cluster" style={{ gap: 12 }}>
                  {t.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="team-logo" src={assetUrl(t.logo_url) || ""} alt="" style={{ width: 44, height: 44 }} />
                  ) : (
                    <div className="team-logo" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{t.name.charAt(0)}</div>
                  )}
                  <div>
                    <div className="card-title" style={{ fontSize: 17 }}>{t.name}</div>
                    <div className="text-mono text-sm text-muted">Lead · {t.owner_name || "—"}</div>
                  </div>
                </div>
                <div className="cluster" style={{ gap: 6 }}>
                  <button className="btn-secondary btn-sm" onClick={() => setSelected(t)}>Manage</button>
                  <button className="btn-danger btn-sm" onClick={() => removeTeam(t)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <TeamMembersModal team={selected} coreUsers={coreUsers} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TeamMembersModal({ team, coreUsers, onClose }: { team: Team; coreUsers: AdminUser[]; onClose: () => void }) {
  const [members, setMembers] = useState<{ id: number; user_id: number; name: string; designation: string; role: string }[]>([]);
  const [addId, setAddId] = useState("");
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api<{ members: { id: number; user_id: number; name: string; designation: string; role: string }[] }>(`/teams/${team.id}/members`);
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    }
  }
  useEffect(() => { load(); }, []);

  const memberIds = new Set(members.map((m) => m.user_id));
  const available = coreUsers.filter((u) => !memberIds.has(u.id));

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addId) return;
    setError("");
    try {
      await api(`/teams/${team.id}/members`, { method: "POST", body: { user_id: Number(addId), designation } });
      setAddId("");
      setDesignation("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    }
  }

  async function removeMember(userId: number) {
    setError("");
    try {
      await api(`/teams/${team.id}/members/${userId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  }

  return (
    <Modal open onClose={onClose} large title={team.name} eyebrow="// Manage members" sub="Add Core members and assign designations.">
      <FormError>{error}</FormError>
      <form onSubmit={addMember} className="card" style={{ padding: 18, marginBottom: 18, background: "var(--grey-50)" }}>
        <div className="form-row">
          <Field label="Member" required>
            <select className="select" value={addId} onChange={(e) => setAddId(e.target.value)} required>
              <option value="">Select a Core member…</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role === "core_head" ? "Core Head" : u.role})</option>
              ))}
            </select>
          </Field>
          <Field label="Designation">
            <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Backend Developer" />
          </Field>
        </div>
        <button className="btn-primary btn-sm" type="submit">Add to team</button>
      </form>

      <div className="stack" style={{ gap: 8 }}>
        {members.map((m) => (
          <div key={m.id} className="split" style={{ padding: "11px 15px", border: "1px solid var(--grey-100)", borderRadius: 10 }}>
            <div>
              <span style={{ fontWeight: 600, color: "var(--grey-900)", fontSize: 14 }}>{m.name}</span>
              <span className="text-mono text-sm text-muted" style={{ marginLeft: 10 }}>{m.designation || (m.role === "core_head" ? "Core Head" : "Core")}</span>
            </div>
            <button className="btn-danger btn-sm" onClick={() => removeMember(m.user_id)}>Remove</button>
          </div>
        ))}
        {members.length === 0 && <p className="card-muted" style={{ textAlign: "center", padding: 12 }}>No members yet.</p>}
      </div>
    </Modal>
  );
}

/* ============================ CERTIFICATES ============================ */
function CertificatesTab() {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState("");
  const [preview, setPreview] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const data = await api<{ templates: CertificateTemplate[] }>("/certificates/templates");
      setTemplates(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    }
  }
  useEffect(() => { load(); }, []);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    try {
      if (previewFile) {
        const body = new FormData();
        body.append("name", name.trim());
        body.append("template_file", file.trim());
        body.append("preview", previewFile);
        await api("/certificates/templates", { method: "POST", body, isForm: true });
      } else {
        await api("/certificates/templates", { method: "POST", body: { name: name.trim(), template_file: file.trim(), preview_image: preview.trim() || null } });
      }
      setMsg("Template created.");
      setName(""); setFile(""); setPreview(""); setPreviewFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="stack-lg">
      <div className="card" style={{ padding: 24, background: "var(--grey-50)" }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 8 }}>How certificates work</h3>
        <p className="card-muted" style={{ lineHeight: 1.7 }}>
          Generate certificates for an event from its <strong>Manage event</strong> page (Core Head of that event, President, or admin).
          Certificates are only issued for registrants who <strong>checked in</strong>, and only once the event is <strong>completed</strong>.
          Templates below are reusable; the built-in generator works without one too.
        </p>
      </div>

      <div className="split">
        <FormError>{error}</FormError>
        <FormSuccess>{msg}</FormSuccess>
      </div>

      <form className="card" onSubmit={createTemplate} style={{ padding: 24 }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 16 }}>New template</h3>
        <div className="form-row">
          <Field label="Name" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Participation" required />
          </Field>
          <Field label="Preview image">
            <ImageSourceInput
              file={previewFile}
              url={preview}
              onFileChange={setPreviewFile}
              onUrlChange={setPreview}
              onError={setError}
            />
          </Field>
        </div>
        <Field label="Template file URL" required hint="Link to an HTML/PDF template with {{name}}, {{event_name}}, etc.">
          <input className="input" value={file} onChange={(e) => setFile(e.target.value)} placeholder="https://…" required />
        </Field>
        <button className="btn-primary btn-sm" type="submit">Create template</button>
      </form>

      <div className="card" style={{ padding: 24 }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 16 }}>Templates</h3>
        <div className="stack" style={{ gap: 8 }}>
          {templates.map((t) => (
            <div key={t.id} className="split" style={{ padding: "11px 15px", background: "var(--grey-50)", borderRadius: 10 }}>
              <div className="cluster" style={{ gap: 10 }}>
                {t.preview_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(t.preview_image) || ""} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                )}
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</span>
              </div>
              <span className="text-mono text-sm text-muted">{t.creator_name || "—"}</span>
            </div>
          ))}
          {templates.length === 0 && <p className="card-muted">No templates yet.</p>}
        </div>
      </div>
    </div>
  );
}

/* ============================ PARTNERS ============================ */
function SponsorsTab() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [form, setForm] = useState({ name: "", logo_url: "", website: "", description: "", sort_order: "0" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const data = await api<{ sponsors: Sponsor[] }>("/sponsors");
      setSponsors(data.sponsors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load partners");
    }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!logoFile && !form.logo_url.trim()) {
      setError("Choose a logo file or provide an image link.");
      return;
    }
    setError(""); setMsg("");
    try {
      if (logoFile) {
        const body = new FormData();
        body.append("name", form.name);
        body.append("logo", logoFile);
        body.append("website", form.website);
        body.append("description", form.description);
        body.append("sort_order", String(Number(form.sort_order) || 0));
        await api("/sponsors", { method: "POST", body, isForm: true });
      } else {
        await api("/sponsors", { method: "POST", body: { ...form, sort_order: Number(form.sort_order) || 0 } });
      }
      setMsg("Partner added.");
      setForm({ name: "", logo_url: "", website: "", description: "", sort_order: "0" });
      setLogoFile(null);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function remove(s: Sponsor) {
    if (!confirm(`Delete partner "${s.name}"?`)) return;
    setError("");
    try {
      await api(`/sponsors/${s.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="stack-lg">
      <div className="split">
        <FormError>{error}</FormError>
        <FormSuccess>{msg}</FormSuccess>
        <span />
        <button className="btn-primary" onClick={() => setOpen(!open)}>{open ? "Cancel" : "+ Add partner"}</button>
      </div>

      {open && (
        <form className="card" onSubmit={create} style={{ padding: 24 }}>
          <div className="form-row">
            <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Logo" required>
              <ImageSourceInput
                file={logoFile}
                url={form.logo_url}
                onFileChange={setLogoFile}
                onUrlChange={(logo_url) => setForm((current) => ({ ...current, logo_url }))}
                onError={setError}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Website"><input className="input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Sort order"><input className="input" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
          </div>
          <Field label="Description"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <button className="btn-primary btn-sm" type="submit">Add partner</button>
        </form>
      )}

      <div className="card" style={{ padding: 24 }}>
        <div className="stack" style={{ gap: 8 }}>
          {sponsors.map((s) => (
            <div key={s.id} className="split" style={{ padding: "11px 15px", background: "var(--grey-50)", borderRadius: 10 }}>
              <div className="cluster" style={{ gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.logo_url && <img src={assetUrl(s.logo_url) || ""} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} />}
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
              </div>
              <button className="btn-danger btn-sm" onClick={() => remove(s)}>Delete</button>
            </div>
          ))}
          {sponsors.length === 0 && <p className="card-muted" style={{ textAlign: "center", padding: 12 }}>No partners yet.</p>}
        </div>
      </div>
    </div>
  );
}

/* ============================ JOIN REQUESTS ============================ */
function RequestsTab() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api<{ joinRequests: JoinRequest[] }>("/join-requests");
      setRequests(data.joinRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    }
  }
  useEffect(() => { load(); }, []);

  async function setStatus(r: JoinRequest, status: JoinRequest["status"]) {
    setError("");
    try {
      await api(`/join-requests/${r.id}`, { method: "PATCH", body: { status } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  const newCount = requests.filter((r) => r.status === "new").length;

  return (
    <div className="stack-lg">
      <FormError>{error}</FormError>
      <div className="split">
        <p className="card-muted">{requests.length} total · <strong>{newCount} new</strong></p>
      </div>
      <div className="stack" style={{ gap: 12 }}>
        {requests.map((r) => (
          <div key={r.id} className="card" style={{ padding: 20 }}>
            <div className="split split-start">
              <div className="flex-1">
                <div className="cluster" style={{ gap: 10 }}>
                  <span style={{ fontWeight: 700, color: "var(--grey-900)", fontSize: 15 }}>{r.name}</span>
                  <Badge variant={r.status === "new" ? "dark" : r.status === "contacted" ? "published" : "completed"}>{r.status}</Badge>
                </div>
                <div className="text-mono text-sm text-muted" style={{ marginTop: 4 }}>{r.email}</div>
                {r.message && <p className="card-muted" style={{ marginTop: 10, lineHeight: 1.6 }}>{r.message}</p>}
                <div className="text-mono text-sm text-muted" style={{ marginTop: 10 }}>{formatDateTime(r.created_at)}</div>
              </div>
              <div className="cluster" style={{ gap: 6 }}>
                {r.status !== "contacted" && <button className="btn-secondary btn-sm" onClick={() => setStatus(r, "contacted")}>Mark contacted</button>}
                {r.status !== "closed" && <button className="btn-ghost btn-sm" onClick={() => setStatus(r, "closed")}>Close</button>}
                {r.status !== "new" && <button className="btn-ghost btn-sm" onClick={() => setStatus(r, "new")}>Reopen</button>}
              </div>
            </div>
          </div>
        ))}
        {requests.length === 0 && <EmptyState title="No join requests" body="New requests from the Join page will appear here." />}
      </div>
    </div>
  );
}

/* ============================ ABOUT PAGE CONTENT ============================ */
function ContentTab() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ about: { content: string } }>("/about")
      .then((d) => { setContent(d.about?.content ?? ""); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    setBusy(true);
    try {
      await api("/about", { method: "PATCH", body: { content } });
      setMsg("About page updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <Spinner />;

  return (
    <form className="card" onSubmit={save} style={{ padding: 24 }}>
      <h3 className="card-title" style={{ fontSize: 17, marginBottom: 8 }}>About page content</h3>
      <p className="card-muted" style={{ marginBottom: 16 }}>This text appears at the top of the public About page. Plain text (line breaks kept).</p>
      <FormError>{error}</FormError>
      <FormSuccess>{msg}</FormSuccess>
      <textarea className="textarea" style={{ minHeight: 220 }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write the club's story…" />
      <div style={{ marginTop: 14 }}>
        <button className="btn-primary btn-sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save about page"}</button>
      </div>
    </form>
  );
}

/* ============================ ADMIN ============================ */

function AdminTab() {
  const { user } = useAuth();
  const [president, setPresident] = useState<PublicUser | null>(null);
  const [vicePresident, setVicePresident] = useState<PublicUser | null>(null);
  const [secretary, setSecretary] = useState<PublicUser | null>(null);
  const [treasurer, setTreasurer] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [assignId, setAssignId] = useState("");
  const [assignVpId, setAssignVpId] = useState("");
  const [assignSecId, setAssignSecId] = useState("");
  const [assignTreasId, setAssignTreasId] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const p = await api<{ president: PublicUser | null }>("/president");
      setPresident(p.president);
    } catch { /* none */ }
    try {
      const vp = await api<{ vicePresident: PublicUser | null }>("/vice-president");
      setVicePresident(vp.vicePresident);
    } catch { /* none */ }
    try {
      const sec = await api<{ secretary: PublicUser | null }>("/secretary");
      setSecretary(sec.secretary);
    } catch { /* none */ }
    try {
      const tres = await api<{ treasurer: PublicUser | null }>("/treasurer");
      setTreasurer(tres.treasurer);
    } catch { /* none */ }
    try {
      const u = await api<{ users: AdminUser[] }>("/users");
      setUsers(u.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }
  useEffect(() => { load(); }, []);

  const coreHeads = users.filter((u) => u.role === "core_head");

  async function assignPresident(e: React.FormEvent) {
    e.preventDefault();
    if (!assignId) return;
    setError(""); setMsg("");
    try {
      await api("/president", { method: "POST", body: { user_id: Number(assignId) } });
      setMsg("President updated.");
      setAssignId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removePresident() {
    if (!confirm("Remove the current President? They keep their Core Head role.")) return;
    setError(""); setMsg("");
    try {
      await api("/president", { method: "DELETE" });
      setMsg("President removed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function assignVicePresident(e: React.FormEvent) {
    e.preventDefault();
    if (!assignVpId) return;
    setError(""); setMsg("");
    try {
      await api("/vice-president", { method: "POST", body: { user_id: Number(assignVpId) } });
      setMsg("Vice President updated.");
      setAssignVpId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removeVicePresident() {
    if (!confirm("Remove the current Vice President? They keep their Core Head role.")) return;
    setError(""); setMsg("");
    try {
      await api("/vice-president", { method: "DELETE" });
      setMsg("Vice President removed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function assignSecretary(e: React.FormEvent) {
    e.preventDefault();
    if (!assignSecId) return;
    setError(""); setMsg("");
    try {
      await api("/secretary", { method: "POST", body: { user_id: Number(assignSecId) } });
      setMsg("Secretary updated.");
      setAssignSecId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removeSecretary() {
    if (!confirm("Remove the current Secretary? They keep their Core Head role.")) return;
    setError(""); setMsg("");
    try {
      await api("/secretary", { method: "DELETE" });
      setMsg("Secretary removed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function assignTreasurer(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTreasId) return;
    setError(""); setMsg("");
    try {
      await api("/treasurer", { method: "POST", body: { user_id: Number(assignTreasId) } });
      setMsg("Treasurer updated.");
      setAssignTreasId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removeTreasurer() {
    if (!confirm("Remove the current Treasurer? They keep their Core Head role.")) return;
    setError(""); setMsg("");
    try {
      await api("/treasurer", { method: "DELETE" });
      setMsg("Treasurer removed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="stack-lg">
      <FormError>{error}</FormError>
      <FormSuccess>{msg}</FormSuccess>

      {/* President */}
      <div className="card" style={{ padding: 24 }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 6 }}>President</h3>
        <p className="card-muted" style={{ marginBottom: 18, lineHeight: 1.6 }}>
          The President is a Core Head with global core-head permissions across all teams.
          There can be only one. Assigning a new President automatically removes the title from the previous one.
        </p>
        <div className="split" style={{ padding: "14px 16px", background: "var(--grey-50)", borderRadius: 12, marginBottom: 18 }}>
          <div>
            <div className="detail-meta-label">Current President</div>
            <div style={{ fontWeight: 700, color: "var(--grey-900)", fontSize: 16 }}>
              {president ? president.name : "— none —"}
            </div>
            {president && <div className="text-mono text-sm text-muted">{users.find((candidate) => candidate.id === president.id)?.email ?? ""}</div>}
          </div>
          {president && <button className="btn-danger btn-sm" onClick={removePresident}>Remove</button>}
        </div>

        <form onSubmit={assignPresident}>
          <Field label="Assign President (must be a Core Head)" required>
            <select className="select" value={assignId} onChange={(e) => setAssignId(e.target.value)} required>
              <option value="">Select a Core Head…</option>
              {coreHeads.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
              ))}
            </select>
          </Field>
          <button className="btn-primary btn-sm" type="submit">Assign President</button>
        </form>
      </div>

      {/* Vice President */}
      <div className="card" style={{ padding: 24 }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 6 }}>Vice President</h3>
        <p className="card-muted" style={{ marginBottom: 18, lineHeight: 1.6 }}>
          The Vice President is a Core Head with the same global core-head permissions as the President.
          There can be only one. A person cannot hold both President and Vice President simultaneously.
        </p>
        <div className="split" style={{ padding: "14px 16px", background: "var(--grey-50)", borderRadius: 12, marginBottom: 18 }}>
          <div>
            <div className="detail-meta-label">Current Vice President</div>
            <div style={{ fontWeight: 700, color: "var(--grey-900)", fontSize: 16 }}>
              {vicePresident ? vicePresident.name : "— none —"}
            </div>
            {vicePresident && <div className="text-mono text-sm text-muted">{users.find((candidate) => candidate.id === vicePresident.id)?.email ?? ""}</div>}
          </div>
          {vicePresident && <button className="btn-danger btn-sm" onClick={removeVicePresident}>Remove</button>}
        </div>

        <form onSubmit={assignVicePresident}>
          <Field label="Assign Vice President (must be a Core Head)" required>
            <select className="select" value={assignVpId} onChange={(e) => setAssignVpId(e.target.value)} required>
              <option value="">Select a Core Head…</option>
              {coreHeads.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
              ))}
            </select>
          </Field>
          <button className="btn-primary btn-sm" type="submit">Assign Vice President</button>
        </form>
      </div>

      {/* Secretary */}
      <div className="card" style={{ padding: 24 }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 6 }}>Secretary</h3>
        <p className="card-muted" style={{ marginBottom: 18, lineHeight: 1.6 }}>
          The Secretary is a Core Head responsible for administrative duties.
          There can be only one. A person cannot hold another leadership title simultaneously.
        </p>
        <div className="split" style={{ padding: "14px 16px", background: "var(--grey-50)", borderRadius: 12, marginBottom: 18 }}>
          <div>
            <div className="detail-meta-label">Current Secretary</div>
            <div style={{ fontWeight: 700, color: "var(--grey-900)", fontSize: 16 }}>
              {secretary ? secretary.name : "— none —"}
            </div>
            {secretary && <div className="text-mono text-sm text-muted">{users.find((candidate) => candidate.id === secretary.id)?.email ?? ""}</div>}
          </div>
          {secretary && <button className="btn-danger btn-sm" onClick={removeSecretary}>Remove</button>}
        </div>

        <form onSubmit={assignSecretary}>
          <Field label="Assign Secretary (must be a Core Head)" required>
            <select className="select" value={assignSecId} onChange={(e) => setAssignSecId(e.target.value)} required>
              <option value="">Select a Core Head…</option>
              {coreHeads.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
              ))}
            </select>
          </Field>
          <button className="btn-primary btn-sm" type="submit">Assign Secretary</button>
        </form>
      </div>

      {/* Treasurer */}
      <div className="card" style={{ padding: 24 }}>
        <h3 className="card-title" style={{ fontSize: 17, marginBottom: 6 }}>Treasurer</h3>
        <p className="card-muted" style={{ marginBottom: 18, lineHeight: 1.6 }}>
          The Treasurer is a Core Head responsible for managing club finances.
          There can be only one. A person cannot hold another leadership title simultaneously.
        </p>
        <div className="split" style={{ padding: "14px 16px", background: "var(--grey-50)", borderRadius: 12, marginBottom: 18 }}>
          <div>
            <div className="detail-meta-label">Current Treasurer</div>
            <div style={{ fontWeight: 700, color: "var(--grey-900)", fontSize: 16 }}>
              {treasurer ? treasurer.name : "— none —"}
            </div>
            {treasurer && <div className="text-mono text-sm text-muted">{users.find((candidate) => candidate.id === treasurer.id)?.email ?? ""}</div>}
          </div>
          {treasurer && <button className="btn-danger btn-sm" onClick={removeTreasurer}>Remove</button>}
        </div>

        <form onSubmit={assignTreasurer}>
          <Field label="Assign Treasurer (must be a Core Head)" required>
            <select className="select" value={assignTreasId} onChange={(e) => setAssignTreasId(e.target.value)} required>
              <option value="">Select a Core Head…</option>
              {coreHeads.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
              ))}
            </select>
          </Field>
          <button className="btn-primary btn-sm" type="submit">Assign Treasurer</button>
        </form>
      </div>

      <div className="card" style={{ padding: 24, background: "var(--grey-50)" }}>
        <h3 className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>Admin account</h3>
        <p className="card-muted" style={{ lineHeight: 1.6 }}>
          Signed in as <strong>{user?.email}</strong>. Admin accounts are seeded directly into the database
          (they can&apos;t be created through signup). Promote members to Core and Core Head from the{" "}
          <a href="/members" style={{ textDecoration: "underline" }}>Members</a> page.
        </p>
      </div>
    </div>
  );
}

/* ============================ BUILDERS (core_head+) ============================ */

const BUILDER_STATUS_STYLES: Record<BuilderRepoStatus, { bg: string; color: string; border: string }> = {
  pending:  { bg: "rgba(212,160,23,0.08)",  color: "#a07800", border: "rgba(212,160,23,0.3)" },
  approved: { bg: "rgba(30,126,52,0.07)",   color: "#1e7e34", border: "rgba(30,126,52,0.25)" },
  rejected: { bg: "rgba(192,57,43,0.07)",   color: "#c0392b", border: "rgba(192,57,43,0.25)" },
};

function BuildersTab() {
  const [repos, setRepos] = useState<BuilderRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BuilderRepoStatus | "all">("pending");
  const [reviewing, setReviewing] = useState<BuilderRepo | null>(null);
  const [reviewStatus, setReviewStatus] = useState<BuilderRepoStatus>("approved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "?status=all";
      const d = await api<{ repos: BuilderRepo[] }>(`/builders${params}`);
      setRepos(d.repos);
    } catch { setRepos([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewing) return;
    setSaving(true); setErr(""); setOk("");
    try {
      await api(`/builders/${reviewing.id}/review`, {
        method: "PATCH",
        body: { status: reviewStatus, review_notes: reviewNotes },
      });
      setOk(`Repo ${reviewStatus === "approved" ? "approved" : "rejected"} successfully.`);
      setReviewing(null);
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(repo: BuilderRepo) {
    if (!confirm(`Remove "${repo.repo_name}"?`)) return;
    try {
      await api(`/builders/${repo.id}`, { method: "DELETE" });
      load();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>BMSIT Builders Review</div>
          <div style={{ fontSize: 14, color: "var(--grey-600)" }}>{repos.length} submission{repos.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              className={statusFilter === s ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              onClick={() => setStatusFilter(s === "all" ? "all" : s as BuilderRepoStatus)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {ok && (
        <div className="form-success" style={{ marginBottom: 16 }}>{ok}</div>
      )}

      {loading ? <Spinner /> : repos.length === 0 ? (
        <EmptyState title="No submissions" body={`No ${statusFilter === "all" ? "" : statusFilter + " "}repo submissions found.`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {repos.map((repo) => {
            const sc = BUILDER_STATUS_STYLES[repo.status];
            return (
              <div key={repo.id} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px",
                        borderRadius: 100, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                      }}>{repo.status}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-400)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{repo.category}</span>
                      {repo.looking_for_contributors && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#1e7e34", fontWeight: 600, letterSpacing: "0.06em" }}>● Seeking contributors</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--grey-900)", marginBottom: 2 }}>{repo.repo_name}</div>
                    <a href={repo.repo_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--grey-500)", wordBreak: "break-all", display: "block", marginBottom: 6 }}>
                      {repo.repo_url}
                    </a>
                    <p style={{ fontSize: 13, color: "var(--grey-500)", lineHeight: 1.5, margin: 0 }}>{repo.description}</p>
                    {repo.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                        {repo.tags.map((t) => <span key={t} className="badge">#{t}</span>)}
                      </div>
                    )}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", marginTop: 8, letterSpacing: "0.04em" }}>
                      By <strong style={{ color: "var(--grey-600)" }}>{repo.submitter_name}</strong> · {formatDate(repo.created_at)}
                      {repo.reviewer_name && <> · Reviewed by <strong style={{ color: "var(--grey-600)" }}>{repo.reviewer_name}</strong></>}
                      {repo.review_notes && <> · <em style={{ color: "var(--grey-500)" }}>{repo.review_notes}</em></>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {repo.status === "pending" && (
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => { setReviewing(repo); setReviewStatus("approved"); setReviewNotes(repo.review_notes); setErr(""); setOk(""); }}
                        id={`dash-review-${repo.id}`}
                      >
                        Review
                      </button>
                    )}
                    {repo.status !== "pending" && (
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => { setReviewing(repo); setReviewStatus(repo.status); setReviewNotes(repo.review_notes); setErr(""); setOk(""); }}
                        id={`dash-re-review-${repo.id}`}
                      >
                        Change
                      </button>
                    )}
                    <button
                      className="btn-secondary btn-sm btn-danger"
                      onClick={() => handleDelete(repo)}
                      id={`dash-delete-repo-${repo.id}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline review panel */}
      {reviewing && (
        <Modal open title={`Review: ${reviewing.repo_name}`} onClose={() => setReviewing(null)}>
          <form onSubmit={handleReview} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "12px 16px", background: "var(--grey-50)", border: "1px solid var(--grey-100)", borderRadius: 10, marginBottom: 4 }}>
              <a href={reviewing.repo_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "var(--grey-600)", wordBreak: "break-all", display: "block", marginBottom: 4 }}>
                {reviewing.repo_url}
              </a>
              <p style={{ fontSize: 13, color: "var(--grey-500)", marginTop: 4, lineHeight: 1.5, margin: 0 }}>{reviewing.description}</p>
            </div>
            <Field label="Decision">
              <div style={{ display: "flex", gap: 10 }}>
                {(["approved", "rejected"] as BuilderRepoStatus[]).map((s) => {
                  const sc = BUILDER_STATUS_STYLES[s as BuilderRepoStatus];
                  return (
                    <label key={s} style={{
                      display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                      padding: "8px 18px", borderRadius: 100, border: "1.5px solid",
                      borderColor: reviewStatus === s ? sc.border : "var(--grey-200)",
                      background: reviewStatus === s ? sc.bg : "transparent",
                      color: reviewStatus === s ? sc.color : "var(--grey-500)",
                      fontWeight: 600, fontSize: 13, transition: "all 0.15s",
                    }}>
                      <input type="radio" value={s} checked={reviewStatus === s}
                        onChange={() => setReviewStatus(s as BuilderRepoStatus)} style={{ display: "none" }} />
                      {s === "approved" ? "✓ Approve" : "✗ Reject"}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Review notes" hint="Optional feedback for the submitter">
              <textarea className="input" value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3} maxLength={1000} placeholder="Looks great! Please add a README first..."
                id="dash-review-notes"
              />
            </Field>
            <FormError>{err}</FormError>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn-secondary" onClick={() => setReviewing(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving} id="dash-review-submit">
                {saving ? "Saving…" : "Save decision"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ============================ PROJECTS (admin) ============================ */

const PROJECT_CATEGORIES: { value: ProjectCategory; label: string }[] = [
  { value: "web",         label: "Web" },
  { value: "ai",          label: "AI / ML" },
  { value: "mobile",      label: "Mobile" },
  { value: "open-source", label: "Open Source" },
  { value: "other",       label: "Other" },
];
const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "shipped", label: "● Shipped" },
  { value: "wip",     label: "○ In Progress" },
  { value: "concept", label: "◇ Concept" },
];

const EMPTY_FORM = {
  title: "", description: "", tags: "",
  category: "web" as ProjectCategory,
  status: "wip" as ProjectStatus,
  author_name: "", year: "",
  github_url: "", live_url: "", featured: false,
};

function ProjectsTab() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");
  const [err, setErr]           = useState("");
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<Project | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [saveBusy, setSaveBusy]       = useState(false);

  async function load() {
    try {
      const d = await api<{ projects: Project[] }>("/projects");
      setProjects(d.projects);
    } catch { /* silent */ }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setErr(""); setMsg("");
    setModalOpen(true);
  }
  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      title: p.title, description: p.description,
      tags: p.tags.join(", "),
      category: p.category, status: p.status,
      author_name: p.author_name, year: p.year,
      github_url: p.github_url || "",
      live_url:   p.live_url   || "",
      featured: p.featured,
    });
    setErr(""); setMsg("");
    setModalOpen(true);
  }

  async function save() {
    setErr("");
    setSaveBusy(true);
    try {
      if (editing) {
        await api(`/projects/${editing.id}`, { method: "PATCH", body: form });
        setMsg("Project updated.");
      } else {
        await api("/projects", { method: "POST", body: form });
        setMsg("Project added.");
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveBusy(false);
    }
  }

  async function deleteProject(p: Project) {
    setBusy(true); setErr(""); setMsg(""); setDeleteTarget(null);
    try {
      await api(`/projects/${p.id}`, { method: "DELETE" });
      setMsg(`"${p.title}" deleted.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally { setBusy(false); }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="stack-lg">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Projects Showcase</div>
          <div style={{ fontSize: 14, color: "var(--grey-600)" }}>{projects.length} project{projects.length !== 1 ? "s" : ""} on the homepage</div>
        </div>
        <button className="btn-primary btn-sm" onClick={openAdd}>+ Add Project</button>
      </div>

      <FormSuccess>{msg}</FormSuccess>
      <FormError>{err}</FormError>

      {projects.length === 0 ? (
        <EmptyState title="No projects yet" body="Add your first real project using the button above." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Category</th>
                <th>Status</th>
                <th>Year</th>
                <th>Featured</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>
                    {p.title}
                    {(p.github_url || p.live_url) && (
                      <span style={{ marginLeft: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--grey-400)" }}>
                        {p.github_url && "GH"}{p.github_url && p.live_url && " · "}{p.live_url && "Live"}
                      </span>
                    )}
                  </td>
                  <td>{p.author_name}</td>
                  <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{p.category}</span></td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: p.status === "shipped" ? "var(--grey-800)" : "var(--grey-500)" }}>
                      {p.status === "shipped" ? "● Shipped" : p.status === "wip" ? "○ WIP" : "◇ Concept"}
                    </span>
                  </td>
                  <td>{p.year}</td>
                  <td>{p.featured ? <Badge variant="dark">Featured</Badge> : <span style={{ color: "var(--grey-400)", fontSize: 12 }}>—</span>}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => openEdit(p)}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >Edit</button>
                      <button
                        title={`Delete "${p.title}"`}
                        disabled={busy}
                        onClick={() => setDeleteTarget(p)}
                        style={{
                          background: "none", border: "1.5px solid rgba(192,57,43,0.3)",
                          borderRadius: 8, padding: "5px 7px", cursor: "pointer",
                          color: "#c0392b", display: "inline-flex", alignItems: "center",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(192,57,43,0.08)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editing ? "Edit Project" : "Add Project"}
          eyebrow="// Projects"
        >
          <div className="stack">
            <FormError>{err}</FormError>
            <Field label="Title" required>
              <input className="input" value={form.title} onChange={f("title")} placeholder="My awesome project" required />
            </Field>
            <Field label="Description">
              <textarea className="input" value={form.description} onChange={f("description")} rows={3} placeholder="What does it do?" style={{ resize: "vertical" }} />
            </Field>
            <Field label="Tags" hint="Comma-separated — e.g. React, Node.js, SQLite">
              <input className="input" value={form.tags} onChange={f("tags")} placeholder="React, TypeScript, Tailwind" />
            </Field>
            <div className="form-row">
              <Field label="Category" required>
                <select className="select" value={form.category} onChange={f("category")}>
                  {PROJECT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Status" required>
                <select className="select" value={form.status} onChange={f("status")}>
                  {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Author / Team">
                <input className="input" value={form.author_name} onChange={f("author_name")} placeholder="Swapnil B." />
              </Field>
              <Field label="Year">
                <input className="input" value={form.year} onChange={f("year")} placeholder="2024" maxLength={4} />
              </Field>
            </div>
            <Field label="GitHub URL" hint="Optional">
              <input className="input" value={form.github_url} onChange={f("github_url")} placeholder="https://github.com/..." />
            </Field>
            <Field label="Live URL" hint="Optional">
              <input className="input" value={form.live_url} onChange={f("live_url")} placeholder="https://..." />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: "var(--grey-700)" }}>
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
              />
              Feature this project (pin to top)
            </label>
            <button className="btn-primary btn-block" onClick={save} disabled={saveBusy}>
              {saveBusy ? "Saving…" : editing ? "Save changes" : "Add project"}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: "50%", background: "rgba(192,57,43,0.1)", color: "#c0392b" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <h2 className="modal-title" style={{ textAlign: "center", fontSize: 20, marginBottom: 8 }}>Delete project?</h2>
            <p className="modal-sub" style={{ textAlign: "center", marginBottom: 20 }}>
              <strong>{deleteTarget.title}</strong> will be permanently removed from the site.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary btn-block" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-danger btn-block" style={{ fontWeight: 700 }} onClick={() => deleteProject(deleteTarget)}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ GALLERY ============================ */
function GalleryTab() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    try {
      const data = await api<{ photos: Photo[] }>("/gallery?limit=200");
      setPhotos(data.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(photo: Photo) {
    if (!confirm(`Delete "${photo.caption || "this photo"}"? This cannot be undone.`)) return;
    setDeleting(photo.id);
    try {
      await api(`/photos/${photo.id}`, { method: "DELETE" });
      setPhotos((prev) => prev ? prev.filter((p) => p.id !== photo.id) : prev);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  if (photos === null && !error) return <Spinner label="Loading gallery" />;
  if (error) return <EmptyState title="Couldn't load gallery" body={error} />;
  if (!photos || photos.length === 0) return <EmptyState title="No photos yet" body="Photos uploaded by members will appear here." />;

  return (
    <div className="stack-lg">
      <div className="split">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Gallery photos</h2>
          <p className="text-muted" style={{ fontSize: 13 }}>
            {photos.length} photo{photos.length !== 1 ? "s" : ""}. As a core head you can delete photos uploaded by your team members; admins can delete any photo.
          </p>
        </div>
      </div>

      <div className="gallery-grid" style={{ gap: 12 }}>
        {photos.map((photo) => {
          const isMine = user && photo.uploaded_by === user.id;
          const isCoreH = user && isCoreHeadPlus(user);
          const showDelete = !!(isMine || isCoreH);

          return (
            <div key={photo.id} className="gallery-item" style={{ position: "relative" }}>
              {photo.is_featured && (
                <div className="gallery-featured">
                  <Badge variant="dark">★ Featured</Badge>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(photo.image_url) || ""}
                alt={photo.caption || "Club photo"}
                loading="lazy"
                style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div className="gallery-item-cap">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {photo.caption || "—"}
                    </span>
                    {photo.uploader_name && (
                      <span style={{ fontSize: 11, opacity: 0.6 }}>by {photo.uploader_name}</span>
                    )}
                  </div>
                  {showDelete && (
                    <button
                      className="gallery-delete-btn"
                      onClick={() => remove(photo)}
                      disabled={deleting === photo.id}
                      style={{ flexShrink: 0 }}
                    >
                      {deleting === photo.id ? "…" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
