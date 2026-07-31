"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, assetUrl, downloadFile } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isCoreHeadPlus, isAdmin, isPresident } from "@/app/lib/roles";
import type {
  ClubEvent,
  Registrant,
  Certificate,
  CertificateTemplate,
  EventHistory,
  LeaderboardEntry,
  Announcement,
  CertificateType,
} from "@/app/lib/types";
import { formatDateTime, formatDate, certTypeLabel } from "@/app/lib/format";
import {
  Spinner,
  EmptyState,
  Badge,
  Tabs,
  FormError,
  FormSuccess,
  Field,
  Modal,
} from "@/app/components/app/ui";

export default function ManageEventPage() {
  const params = useParams();
  const id = Number(params.id);
  return <ManageEvent id={id} key={id} />;
}

const CERT_TYPES: CertificateType[] = [
  "participation",
  "winner",
  "volunteer",
  "speaker",
  "organizer",
  "special_recognition",
];

function ManageEvent({ id }: { id: number }) {
  const { user, ready, openAuth } = useAuth();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("registrants");

  const load = useCallback(async () => {
    try {
      const data = await api<{ event: ClubEvent }>(`/events/${id}`);
      setEvent(data.event);
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!ready) return <div className="page"><div className="section-inner"><Spinner /></div></div>;
  if (!user) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Sign in required" body="Event management is for Core Heads and admins." action={<button className="btn-primary" onClick={() => openAuth("login")}>Sign in</button>} />
      </div></div>
    );
  }
  if (!isCoreHeadPlus(user)) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Core Head access only" body="Only the event's organiser (a Core Head), the President, or an admin can manage this event." action={<Link href={`/events/${id}`} className="btn-secondary btn-sm">Back to event</Link>} />
      </div></div>
    );
  }
  if (notFound) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Event not found" body="This event doesn't exist." action={<Link href="/dashboard" className="btn-secondary btn-sm">Back to dashboard</Link>} />
      </div></div>
    );
  }
  if (!event) return <div className="page"><div className="section-inner"><Spinner label="Loading event" /></div></div>;

  const tabs = [
    { id: "registrants", label: "Registrants" },
    { id: "checkin", label: "Check-in" },
    { id: "certificates", label: "Certificates" },
    { id: "history", label: "History" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "announcements", label: "Announcements" },
  ];

  return (
    <div className="page">
      <div className="section-inner section-inner-wide">
        <div className="split split-start" style={{ marginBottom: 8 }}>
          <div>
            <span className="section-eyebrow">// Manage event</span>
            <h1 className="page-title" style={{ fontSize: 32 }}>{event.title}</h1>
            <div className="cluster" style={{ marginTop: 10 }}>
              <Badge variant={event.status === "published" ? "published" : event.status === "draft" ? "draft" : "completed"} dot>{event.status}</Badge>
              <span className="text-mono text-sm text-muted">{formatDateTime(event.start_datetime)}</span>
            </div>
          </div>
          <Link href={`/events/${event.id}`} className="btn-ghost btn-sm">View public page →</Link>
        </div>

        <Tabs active={tab} onChange={setTab} tabs={tabs} />

        {tab === "registrants" && <RegistrantsPanel event={event} />}
        {tab === "checkin" && <CheckinPanel event={event} />}
        {tab === "certificates" && <CertificatesPanel event={event} />}
        {tab === "history" && <HistoryPanel event={event} />}
        {tab === "leaderboard" && <LeaderboardPanel event={event} />}
        {tab === "announcements" && <AnnouncementsPanel event={event} />}
      </div>
    </div>
  );
}

/* ============================ REGISTRANTS ============================ */
function RegistrantsPanel({ event }: { event: ClubEvent }) {
  const [registrants, setRegistrants] = useState<Registrant[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ registrants: Registrant[] }>(`/events/${event.id}/registrants`);
      setRegistrants(data.registrants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registrants");
    }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  async function importCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setMsg("");
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("csv", file);
      const res = await api<{ created: number; skipped: number; errors: number; total: number; linked?: number; notLinked?: number }>(
        `/events/${event.id}/registrants/import`,
        { method: "POST", body: fd, isForm: true },
      );
      setMsg(`Imported ${res.created} of ${res.total} rows · ${res.skipped} duplicates skipped · ${res.errors} errors.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  async function undo(r: Registrant) {
    if (!confirm(`Undo check-in for ${r.name}?`)) return;
    setError("");
    try {
      await api(`/events/${event.id}/checkin/${r.id}`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function exportCsv() {
    setError("");
    try {
      await downloadFile(`/events/${event.id}/attendance/export`, `attendance-${event.id}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  const checkedIn = registrants?.filter((r) => r.checked_in).length || 0;

  return (
    <div className="stack-lg">
      <div className="split">
        <div className="cluster" style={{ gap: 16 }}>
          <FormError>{error}</FormError>
          <FormSuccess>{msg}</FormSuccess>
        </div>
        <div className="cluster">
          <label className="btn-primary btn-sm" style={{ cursor: importing ? "wait" : "pointer" }}>
            {importing ? "Importing…" : "Import CSV"}
            <input type="file" accept=".csv,text/csv" onChange={importCsv} style={{ display: "none" }} disabled={importing} />
          </label>
          <button className="btn-secondary btn-sm" onClick={exportCsv}>Export attendance</button>
        </div>
      </div>

      <p className="card-muted">
        {registrants ? `${registrants.length} registrants · ${checkedIn} checked in` : ""}
        {" · CSV columns: name, email, team (optional). Duplicates are skipped automatically."}
      </p>

      {registrants === null && !error && <Spinner label="Loading registrants" />}
      {registrants && registrants.length === 0 && (
        <EmptyState title="No registrants yet" body="Import a CSV exported from Unstop to add registrants." />
      )}

      {registrants && registrants.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Team</th><th>Linked acct</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
            </thead>
            <tbody>
              {registrants.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: "var(--grey-900)" }}>{r.name}</td>
                  <td className="text-mono text-sm">{r.email}</td>
                  <td className="text-sm">{r.team_name || "—"}</td>
                  <td>{r.user_id ? <Badge>linked</Badge> : <span className="text-muted text-sm">—</span>}</td>
                  <td>
                    {r.checked_in ? (
                      <Badge variant="dark">In · {r.checked_in_at ? formatDateTime(r.checked_in_at) : ""}</Badge>
                    ) : (
                      <span className="text-muted text-sm">Not checked in</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      {r.checked_in ? (
                        <button className="btn-ghost btn-sm" onClick={() => undo(r)}>Undo</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================ CHECK-IN MANAGER ============================ */
function CheckinPanel({ event }: { event: ClubEvent }) {
  const [registrants, setRegistrants] = useState<Registrant[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ registrants: Registrant[] }>(`/events/${event.id}/registrants`);
      setRegistrants(data.registrants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  async function undo(r: Registrant) {
    if (!confirm(`Undo check-in for ${r.name}?`)) return;
    try {
      await api(`/events/${event.id}/checkin/${r.id}`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const filtered = (registrants || []).filter((r) => {
    const q = query.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.team_name || "").toLowerCase().includes(q);
  });
  const checkedIn = (registrants || []).filter((r) => r.checked_in);

  return (
    <div className="stack-lg">
      <div className="split">
        <div className="cluster" style={{ gap: 16 }}>
          <div className="stat-card" style={{ padding: "14px 20px" }}>
            <div className="stat-card-num" style={{ fontSize: 28 }}>{checkedIn.length}</div>
            <div className="stat-card-label">Checked in</div>
          </div>
          <div className="stat-card" style={{ padding: "14px 20px" }}>
            <div className="stat-card-num" style={{ fontSize: 28 }}>{(registrants || []).length - checkedIn.length}</div>
            <div className="stat-card-label">Absent</div>
          </div>
        </div>
        <input className="input" style={{ width: 240 }} placeholder="Filter by name, email, team…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <FormError>{error}</FormError>

      {registrants === null && !error && <Spinner />}
      {registrants && filtered.length === 0 && <EmptyState title="No registrants" body="Import registrants first." />}
      {registrants && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Team</th><th>Checked in</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: "var(--grey-900)" }}>{r.name}</td>
                  <td className="text-mono text-sm">{r.email}</td>
                  <td className="text-sm">{r.team_name || "—"}</td>
                  <td>{r.checked_in ? <Badge variant="dark">{r.checked_in_at ? formatDateTime(r.checked_in_at) : "Yes"}</Badge> : <span className="text-muted text-sm">—</span>}</td>
                  <td><div className="table-actions">{r.checked_in && <button className="btn-ghost btn-sm" onClick={() => undo(r)}>Undo</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================ CERTIFICATES ============================ */
function CertificatesPanel({ event }: { event: ClubEvent }) {
  const { user } = useAuth();
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [genType, setGenType] = useState<CertificateType>("participation");
  const [genTemplate, setGenTemplate] = useState("");
  const [genMode, setGenMode] = useState("checked_in");
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ certificates: Certificate[] }>(`/events/${event.id}/certificates`);
      setCerts(data.certificates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load certificates");
    }
  }, [event.id]);
  useEffect(() => {
    load();
    api<{ templates: CertificateTemplate[] }>("/certificates/templates").then((d) => setTemplates(d.templates)).catch(() => {});
  }, [load]);

  const canGenerate = event.status === "completed";
  const sent = certs?.filter((c) => c.email_status === "sent").length || 0;
  const failed = certs?.filter((c) => c.email_status === "failed").length || 0;
  const pending = (certs?.length || 0) - sent - failed;

  async function bulkGenerate(e: FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    setBusy(true);
    try {
      const res = await api<{ created: number; skipped: number; failed: number }>(
        `/events/${event.id}/certificates/generate/bulk`,
        { method: "POST", body: { certificate_type: genType, template_id: genTemplate ? Number(genTemplate) : undefined, mode: genMode } },
      );
      setMsg(`Generated ${res.created} certificates · ${res.skipped} duplicates skipped · ${res.failed} failed.`);
      setGenOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function bulkEmail() {
    if (!confirm(`Email certificates to all ${pending + failed} unsent recipients?`)) return;
    setError(""); setMsg("");
    setEmailBusy(true);
    try {
      const res = await api<{ sent: number; failed: number }>(`/events/${event.id}/certificates/email/bulk`, { method: "POST" });
      setMsg(`Emailed ${res.sent} certificates · ${res.failed} failed.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email failed");
    } finally {
      setEmailBusy(false);
    }
  }

  async function emailOne(c: Certificate) {
    setError("");
    try {
      await api(`/events/${event.id}/certificates/email`, { method: "POST", body: { certificate_id: c.id } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email failed");
    }
  }

  const canEmailAny = isAdmin(user) || isPresident(user) || (user?.role === "core_head" && event.organizer_id === user.id);

  return (
    <div className="stack-lg">
      <div className="split">
        <div className="cluster" style={{ gap: 12 }}>
          {certs && <Badge>{certs.length} total</Badge>}
          {certs && <Badge variant="published">{sent} sent</Badge>}
          {pending > 0 && <Badge>{pending} pending</Badge>}
          {failed > 0 && <Badge variant="draft">{failed} failed</Badge>}
        </div>
        <div className="cluster">
          <button className="btn-primary btn-sm" onClick={() => setGenOpen(true)} disabled={!canGenerate}>
            Generate
          </button>
          <button className="btn-secondary btn-sm" onClick={bulkEmail} disabled={!canEmailAny || (pending === 0 && failed === 0) || emailBusy}>
            {emailBusy ? "Sending…" : "Email all"}
          </button>
        </div>
      </div>

      {!canGenerate && (
        <div className="card" style={{ padding: 20, background: "var(--grey-50)", borderLeft: "3px solid var(--grey-500)" }}>
          <p className="card-muted" style={{ margin: 0 }}>
            Certificates can only be generated once the event is <Badge variant="completed">completed</Badge>.
            Mark it complete from the Dashboard → Events tab.
          </p>
        </div>
      )}

      <FormError>{error}</FormError>
      <FormSuccess>{msg}</FormSuccess>

      {certs === null && !error && <Spinner label="Loading certificates" />}
      {certs && certs.length === 0 && (
        <EmptyState title="No certificates yet" body={canGenerate ? "Generate certificates for checked-in registrants." : "Complete the event and import/check-in registrants first."} />
      )}

      {certs && certs.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Recipient</th><th>Type</th><th>Email status</th><th>Issued</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: "var(--grey-900)" }}>{c.recipient_name || "—"}</td>
                  <td><Badge>{certTypeLabel(c.certificate_type)}</Badge></td>
                  <td>
                    {c.email_status === "sent" ? <Badge variant="published">Sent</Badge> : c.email_status === "failed" ? <Badge variant="draft">Failed</Badge> : <Badge>Pending</Badge>}
                  </td>
                  <td className="text-sm text-muted">{formatDate(c.generated_at)}</td>
                  <td>
                    <div className="table-actions">
                      {c.pdf_url && <a className="btn-ghost btn-sm" href={assetUrl(c.pdf_url) || "#"} target="_blank" rel="noopener noreferrer">PDF</a>}
                      {canEmailAny && c.email_status !== "sent" && (
                        <button className="btn-secondary btn-sm" onClick={() => emailOne(c)}>Email</button>
                      )}
                      <Link className="btn-ghost btn-sm" href={`/verify/${c.verification_id}`} target="_blank">Verify</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate certificates" eyebrow="// Bulk" sub="Only checked-in registrants are eligible. Duplicates are skipped.">
        <form onSubmit={bulkGenerate}>
          <Field label="Certificate type" required>
            <select className="select" value={genType} onChange={(e) => setGenType(e.target.value as CertificateType)}>
              {CERT_TYPES.map((t) => <option key={t} value={t}>{certTypeLabel(t)}</option>)}
            </select>
          </Field>
          <Field label="Recipients">
            <select className="select" value={genMode} onChange={(e) => setGenMode(e.target.value)}>
              <option value="checked_in">All checked-in</option>
              <option value="volunteers">Volunteers (team contains &quot;volunteer&quot;)</option>
            </select>
          </Field>
          {templates.length > 0 && (
            <Field label="Template (optional)">
              <select className="select" value={genTemplate} onChange={(e) => setGenTemplate(e.target.value)}>
                <option value="">— Default certificate —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          <button className="btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Generating…" : "Generate certificates"}
          </button>
        </form>
      </Modal>
    </div>
  );
}

/* ============================ HISTORY ============================ */
function HistoryPanel({ event }: { event: ClubEvent }) {
  const [gist, setGist] = useState("");
  const [winners, setWinners] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ history: EventHistory | null }>(`/event-history/${event.id}`)
      .then((d) => {
        setGist(d.history?.gist || "");
        setWinners(d.history?.winners || "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [event.id]);

  const locked = event.status !== "completed";

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    setBusy(true);
    try {
      await api(`/event-history/${event.id}`, { method: "POST", body: { gist, winners } });
      setMsg("History saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <Spinner />;

  return (
    <div className="stack-lg">
      {locked && (
        <div className="card" style={{ padding: 20, background: "var(--grey-50)", borderLeft: "3px solid var(--grey-500)" }}>
          <p className="card-muted" style={{ margin: 0 }}>
            History can only be written for <Badge variant="completed">completed</Badge> events. Complete the event first.
          </p>
        </div>
      )}
      <FormError>{error}</FormError>
      <FormSuccess>{msg}</FormSuccess>
      <form className="card" onSubmit={save} style={{ padding: 24, opacity: locked ? 0.6 : 1 }}>
        <Field label="How it went (gist)">
          <textarea className="textarea" style={{ minHeight: 130 }} value={gist} onChange={(e) => setGist(e.target.value)} placeholder="What happened, attendance, highlights…" disabled={locked} />
        </Field>
        <Field label="Winners">
          <textarea className="textarea" value={winners} onChange={(e) => setWinners(e.target.value)} placeholder={"1st — Team X\n2nd — Team Y"} disabled={locked} />
        </Field>
        <button className="btn-primary btn-sm" type="submit" disabled={locked || busy}>{busy ? "Saving…" : "Save history"}</button>
      </form>
    </div>
  );
}

/* ============================ LEADERBOARD ============================ */
function LeaderboardPanel({ event }: { event: ClubEvent }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [team, setTeam] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<LeaderboardEntry[] | { leaderboard?: LeaderboardEntry[] }>(`/events/${event.id}/leaderboard`);
      setEntries(Array.isArray(data) ? data : data.leaderboard || []);
    } catch {
      setEntries([]);
    }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  async function addOrUpdate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/events/${event.id}/leaderboard`, {
        method: "POST",
        body: { entries: [{ team_name: team.trim(), score: Number(score) }] },
      });
      setTeam("");
      setScore("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...entries].sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.score - a.score);

  return (
    <div className="stack-lg">
      <FormError>{error}</FormError>
      <form className="card" onSubmit={addOrUpdate} style={{ padding: 22 }}>
        <h3 className="card-title" style={{ fontSize: 16, marginBottom: 14 }}>Add / update a team&apos;s score</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Team name" value={team} onChange={(e) => setTeam(e.target.value)} required />
          <input className="input" style={{ width: 120 }} type="number" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} required />
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? "…" : "Set score"}</button>
        </div>
        <p className="form-note">Ranks recalculate automatically. Updating an existing team name overwrites its score.</p>
      </form>

      <div className="stack" style={{ gap: 10 }}>
        {sorted.map((e, i) => (
          <div className="lb-row" key={e.id}>
            <span className={`lb-rank ${i < 3 ? "top" : ""}`}>{e.rank || i + 1}</span>
            <span className="lb-team">{e.team_name}</span>
            <span className="lb-score">{e.score}</span>
          </div>
        ))}
        {sorted.length === 0 && <EmptyState title="No leaderboard entries" body="Add a team score to get started." />}
      </div>
    </div>
  );
}

/* ============================ ANNOUNCEMENTS ============================ */
function AnnouncementsPanel({ event }: { event: ClubEvent }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<Announcement[] | { announcements?: Announcement[] }>(`/events/${event.id}/announcements`);
      setItems(Array.isArray(data) ? data : data.announcements || []);
    } catch {
      setItems([]);
    }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);

  async function post(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/events/${event.id}/announcements`, { method: "POST", body: { message: message.trim() } });
      setMessage("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Announcement) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await api(`/events/announcements/${a.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="stack-lg">
      <FormError>{error}</FormError>
      <form className="card" onSubmit={post} style={{ padding: 22 }}>
        <Field label="New announcement">
          <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Something all registrants should know…" required />
        </Field>
        <button className="btn-primary btn-sm" type="submit" disabled={busy || !message.trim()}>{busy ? "Posting…" : "Post announcement"}</button>
        <p className="form-note">All registrants linked to accounts get a notification.</p>
      </form>

      <div className="stack" style={{ gap: 12 }}>
        {items.map((a) => (
          <div key={a.id} className="announce-item">
            <div className="split split-start">
              <div className="announce-msg flex-1">{a.message}</div>
              {(isAdmin(user) || a.posted_by === user?.id) && (
                <button className="btn-danger btn-sm" onClick={() => remove(a)}>Delete</button>
              )}
            </div>
            <div className="announce-meta">{a.posted_by_name || "Core team"} · {formatDateTime(a.posted_at)}</div>
          </div>
        ))}
        {items.length === 0 && <EmptyState title="No announcements yet" body="Post the first announcement for this event." />}
      </div>
    </div>
  );
}
