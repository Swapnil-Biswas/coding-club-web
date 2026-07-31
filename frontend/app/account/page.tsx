"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { api, assetUrl } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { displayTitle } from "@/app/lib/roles";
import type { ClubEvent, Certificate } from "@/app/lib/types";
import { formatDate, certTypeLabel } from "@/app/lib/format";
import {
  Field,
  FormError,
  FormSuccess,
  Spinner,
  EmptyState,
  Avatar,
  Badge,
} from "@/app/components/app/ui";

export default function AccountPage() {
  const { user, ready, openAuth } = useAuth();

  if (!ready) {
    return (
      <div className="page">
        <div className="section-inner">
          <Spinner label="Loading account" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <div className="section-inner">
          <EmptyState
            title="You're not signed in"
            body="Sign in with your club account to manage your profile and see your activity."
            action={
              <button className="btn-primary" onClick={() => openAuth("login")}>
                Sign in
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return <AccountInner key={user.id} />;
}

function AccountInner() {
  const { user, refresh } = useAuth();
  if (!user) return null;
  return (
    <div className="page">
      <div className="section-inner section-inner-sm">
        <div className="split split-start" style={{ marginBottom: 32 }}>
          <div className="cluster" style={{ gap: 18 }}>
            <Avatar name={user.name} src={assetUrl(user.profile_photo_url)} large />
            <div>
              <span className="section-eyebrow">// Account</span>
              <h1 className="page-title" style={{ fontSize: 34 }}>{user.name}</h1>
              <div className="cluster" style={{ marginTop: 8, gap: 8 }}>
                <Badge variant="dark">{displayTitle(user)}</Badge>
                <span className="text-mono text-sm text-muted">{user.email}</span>
              </div>
            </div>
          </div>
          <PhotoUpload onDone={refresh} />
        </div>

        <div className="stack-lg">
          <ChangePasswordCard />
          <MyEventsCard />
          <MyCertificatesCard />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Profile photo ---------------- */
function PhotoUpload({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      await api("/users/me/photo", { method: "POST", body: fd, isForm: true });
      setMsg("Photo updated.");
      await onDone();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <label className="btn-secondary btn-sm" style={{ cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Uploading…" : "Change photo"}
        <input type="file" accept="image/*" onChange={onChange} style={{ display: "none" }} disabled={busy} />
      </label>
      {msg && <div className="text-mono text-sm" style={{ color: "#1e7e34", marginTop: 6 }}>{msg}</div>}
      {err && <div className="text-mono text-sm" style={{ color: "#c0392b", marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/* ---------------- Change password ---------------- */
function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (next !== confirm) {
      setErr("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api("/users/me/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      setMsg("Password changed.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 28 }}>
      <h3 className="card-title" style={{ marginBottom: 18 }}>Change password</h3>
      <form onSubmit={submit} style={{ maxWidth: 380 }}>
        <FormError>{err}</FormError>
        <FormSuccess>{msg}</FormSuccess>
        <Field label="Current password" required>
          <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </Field>
        <div className="form-row">
          <Field label="New password" required hint="At least 8 characters">
            <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          </Field>
        </div>
        <button className="btn-primary btn-sm" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

/* ---------------- My events (attended) ---------------- */
function MyEventsCard() {
  const [events, setEvents] = useState<ClubEvent[] | null>(null);

  useEffect(() => {
    api<{ events: ClubEvent[] }>("/users/me/attended-events")
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="split" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Events attended</h3>
        {events && <Badge>{events.length} total</Badge>}
      </div>
      {events === null && <Spinner label="" />}
      {events && events.length === 0 && (
        <p className="card-muted">You haven&apos;t checked in to any events yet. Your attended events will show up here.</p>
      )}
      {events && events.length > 0 && (
        <div className="stack" style={{ gap: 10 }}>
          {events.map((ev) => (
            <Link key={ev.id} href={`/events/${ev.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="split" style={{ padding: "13px 16px", background: "var(--grey-50)", borderRadius: 12, border: "1px solid var(--grey-100)" }}>
                <span style={{ fontWeight: 600, color: "var(--grey-900)", fontSize: 14.5 }}>{ev.title}</span>
                <span className="text-mono text-sm text-muted">{formatDate(ev.start_datetime)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- My certificates ---------------- */
function MyCertificatesCard() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);

  useEffect(() => {
    api<{ certificates: Certificate[] }>("/users/me/certificates")
      .then((d) => setCerts(d.certificates))
      .catch(() => setCerts([]));
  }, []);

  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="split" style={{ marginBottom: 16 }}>
        <h3 className="card-title">My certificates</h3>
        {certs && <Badge>{certs.length}</Badge>}
      </div>
      {certs === null && <Spinner label="" />}
      {certs && certs.length === 0 && (
        <p className="card-muted">No certificates yet. Attend events and they&apos;ll appear here.</p>
      )}
      {certs && certs.length > 0 && (
        <div className="grid grid-2">
          {certs.map((c) => (
            <div key={c.id} className="card" style={{ padding: 22 }}>
              <div className="split" style={{ marginBottom: 10 }}>
                <Badge variant="dark">{certTypeLabel(c.certificate_type)}</Badge>
                <span className="text-mono text-sm text-muted">{formatDate(c.generated_at)}</span>
              </div>
              <div style={{ fontWeight: 600, color: "var(--grey-900)", fontSize: 15 }}>{c.event_title || `Event #${c.event_id}`}</div>
              <div className="cluster" style={{ marginTop: 16, gap: 8 }}>
                {c.pdf_url && (
                  <a className="btn-secondary btn-sm" href={assetUrl(c.pdf_url) || "#"} target="_blank" rel="noopener noreferrer">
                    Download PDF
                  </a>
                )}
                <Link className="btn-ghost btn-sm" href={`/verify/${c.verification_id}`}>
                  Verify
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
