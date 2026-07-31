"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isCorePlus } from "@/app/lib/roles";
import type { ClubEvent, Registrant } from "@/app/lib/types";
import {
  PageHeader,
  Spinner,
  EmptyState,
  Field,
  FormError,
  Badge,
} from "@/app/components/app/ui";

interface CheckinResult {
  success?: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
  registrantId?: number;
}

export default function CheckinPage() {
  return (
    <Suspense fallback={<div className="page"><div className="section-inner"><Spinner /></div></div>}>
      <CheckinGate />
    </Suspense>
  );
}

function CheckinGate() {
  const { user, ready, openAuth } = useAuth();
  const search = useSearchParams();

  if (!ready) {
    return <div className="page"><div className="section-inner"><Spinner /></div></div>;
  }
  if (!user) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Sign in required" body="Check-in is for Core members and above." action={<button className="btn-primary" onClick={() => openAuth("login")}>Sign in</button>} />
      </div></div>
    );
  }
  if (!isCorePlus(user)) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Core & above only" body="Only Core members, Core Heads, and admins can run check-in." />
      </div></div>
    );
  }

  return <CheckinInner user={user} initialEventId={Number(search.get("event")) || 0} initialToken={search.get("token") || ""} />;
}

function CheckinInner({
  user,
  initialEventId,
  initialToken,
}: {
  user: { role: string };
  initialEventId: number;
  initialToken: string;
}) {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [eventId, setEventId] = useState<number>(initialEventId);
  const [token, setToken] = useState(initialToken);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Registrant[]>([]);
  const [searching, setSearching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5Ref = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  // Load check-in-able events (published / completed). Core+ sees all anyway.
  useEffect(() => {
    api<{ events: ClubEvent[] }>("/events")
      .then((d) => {
        const usable = d.events.filter((e) => e.status !== "draft");
        setEvents(usable);
        if (!initialEventId && usable.length) setEventId(usable[0].id);
      })
      .catch(() => {});
  }, [initialEventId]);

  async function submitToken(e?: FormEvent, overrideToken?: string) {
    e?.preventDefault();
    const t = (overrideToken ?? token).trim();
    if (!eventId || !t) return;
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await api<CheckinResult>(`/events/${eventId}/checkin`, {
        method: "POST",
        body: { qr_code_token: t },
      });
      setResult(res);
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  // Camera scanner (lazy load html5-qrcode)
  async function startCamera() {
    if (!scannerRef.current) return;
    setCameraActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const elId = "qr-reader";
      scannerRef.current.id = elId;
      const scanner = new Html5Qrcode(elId);
      html5Ref.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (decoded: string) => {
          // Extract a plain token from a URL if the QR encodes one
          let t = decoded.trim();
          try {
            const u = new URL(t);
            const q = u.searchParams.get("token");
            if (q) t = q;
          } catch {
            /* not a URL, use raw */
          }
          submitToken(undefined, t);
        },
        () => {},
      );
    } catch {
      setCameraActive(false);
      setError("Couldn't start the camera. You can paste the token manually.");
    }
  }

  async function stopCamera() {
    try {
      await html5Ref.current?.stop();
      html5Ref.current?.clear();
    } catch {
      /* ignore */
    }
    setCameraActive(false);
  }

  useEffect(() => () => { void stopCamera(); }, []);

  async function doSearch() {
    if (!eventId || !search.trim()) return;
    setSearching(true);
    try {
      const data = await api<{ registrants: Registrant[] }>(
        `/events/${eventId}/checkin/manual?q=${encodeURIComponent(search.trim())}`,
      );
      setSearchResults(data.registrants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function manualCheckin(registrantId: number) {
    setError("");
    try {
      const res = await api<CheckinResult>(`/events/${eventId}/checkin/manual`, {
        method: "POST",
        body: { registrant_id: registrantId },
      });
      setResult(res);
      setSearchResults((prev) => prev.map((r) => (r.id === registrantId ? { ...r, checked_in: 1 } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    }
  }

  const liveCount = searchResults.filter((r) => r.checked_in).length;

  return (
    <div className="page">
      <div className="section-inner section-inner-sm">
        <PageHeader
          eyebrow="// Check-in"
          title="Event"
          ghost="check-in."
          sub="Scan a registrant's QR code, or find them by name, email, or team."
        />

        <Field label="Event" required>
          <select className="select" value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} · {new Date(ev.start_datetime).toLocaleDateString()}
              </option>
            ))}
          </select>
        </Field>

        <div className="tabs" style={{ marginTop: 8 }}>
          <button className={`tab ${mode === "scan" ? "is-active" : ""}`} onClick={() => setMode("scan")}>Scan QR</button>
          <button className={`tab ${mode === "manual" ? "is-active" : ""}`} onClick={() => setMode("manual")}>Manual</button>
        </div>

        <FormError>{error}</FormError>
        {result && (
          <div className={result.alreadyCheckedIn ? "form-error" : "form-success"} style={{ marginBottom: 18 }}>
            {result.message || (result.alreadyCheckedIn ? "Already checked in." : "Checked in successfully.")}
          </div>
        )}

        {mode === "scan" ? (
          <div className="stack">
            <div className="card" style={{ padding: 24 }}>
              <div className="split" style={{ marginBottom: 16 }}>
                <h3 className="card-title" style={{ fontSize: 17 }}>Camera scanner</h3>
                {!cameraActive ? (
                  <button className="btn-secondary btn-sm" onClick={startCamera} disabled={!eventId}>
                    Start camera
                  </button>
                ) : (
                  <button className="btn-secondary btn-sm" onClick={stopCamera}>Stop camera</button>
                )}
              </div>
              <div ref={scannerRef} style={{ width: "100%", minHeight: cameraActive ? 300 : 0, borderRadius: 12, overflow: "hidden", background: cameraActive ? "#000" : "transparent" }} />
              {!cameraActive && (
                <p className="card-muted" style={{ textAlign: "center" }}>
                  Point the camera at a registrant&apos;s QR code, or paste the token below.
                </p>
              )}
            </div>

            <form className="card" style={{ padding: 24 }} onSubmit={(e) => submitToken(e)}>
              <h3 className="card-title" style={{ fontSize: 17, marginBottom: 14 }}>Paste token</h3>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="input text-mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="QR token…"
                  style={{ flex: 1 }}
                />
                <button className="btn-primary" type="submit" disabled={busy || !eventId || !token.trim()}>
                  {busy ? "…" : "Check in"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Search name, email, or team…"
                style={{ flex: 1 }}
              />
              <button className="btn-secondary" onClick={doSearch} disabled={searching || !eventId}>
                {searching ? "…" : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <p className="text-mono text-sm text-muted" style={{ marginBottom: 12 }}>
                {searchResults.length} found · {liveCount} checked in
              </p>
            )}

            <div className="stack" style={{ gap: 10 }}>
              {searchResults.map((r) => (
                <div key={r.id} className="split" style={{ padding: "13px 16px", background: "var(--grey-50)", borderRadius: 12, border: "1px solid var(--grey-100)" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--grey-900)", fontSize: 14.5 }}>{r.name}</div>
                    <div className="text-mono text-sm text-muted">{r.email}{r.team_name ? ` · ${r.team_name}` : ""}</div>
                  </div>
                  {r.checked_in ? (
                    <Badge variant="dark">Checked in</Badge>
                  ) : (
                    <button className="btn-primary btn-sm" onClick={() => manualCheckin(r.id)}>Check in</button>
                  )}
                </div>
              ))}
              {searchResults.length === 0 && search.trim() && !searching && (
                <p className="card-muted" style={{ textAlign: "center", padding: 16 }}>No registrants match &quot;{search}&quot;.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
