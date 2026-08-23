"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, assetUrl } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isCorePlus, isCoreHeadPlus, isSuperCoreHead } from "@/app/lib/roles";
import type {
  ClubEvent,
  EventHistory,
  LeaderboardEntry,
  Announcement,
} from "@/app/lib/types";
import { formatDateTime, formatDateRange } from "@/app/lib/format";
import { Spinner, EmptyState, Badge } from "@/app/components/app/ui";
import QrImage from "@/app/components/app/QrImage";

export default function EventDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  return <EventDetail id={id} key={id} />;
}

function EventDetail({ id }: { id: number }) {
  const { user, openAuth } = useAuth();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [history, setHistory] = useState<EventHistory | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [myQr, setMyQr] = useState<{ qr_code_token: string; checked_in: number | boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ event: ClubEvent }>(`/events/${id}`);
      setEvent(data.event);
      // Fetch the optional bits in parallel; ignore individual failures.
      api<{ history: EventHistory | null }>(`/event-history/${id}`)
        .then((d) => setHistory(d.history))
        .catch(() => {});
      api<LeaderboardEntry[] | { leaderboard?: LeaderboardEntry[] }>(`/events/${id}/leaderboard`)
        .then((d) => setLeaderboard(Array.isArray(d) ? d : d.leaderboard || []))
        .catch(() => setLeaderboard([]));
      api<Announcement[] | { announcements?: Announcement[] }>(`/events/${id}/announcements`)
        .then((d) => setAnnouncements(Array.isArray(d) ? d : d.announcements || []))
        .catch(() => setAnnouncements([]));
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll leaderboard + announcements for a live feel on published events.
  useEffect(() => {
    if (!event || event.status === "draft") return;
    const t = setInterval(() => {
      api<LeaderboardEntry[] | { leaderboard?: LeaderboardEntry[] }>(`/events/${id}/leaderboard`)
        .then((d) => setLeaderboard(Array.isArray(d) ? d : d.leaderboard || []))
        .catch(() => {});
      api<Announcement[] | { announcements?: Announcement[] }>(`/events/${id}/announcements`)
        .then((d) => setAnnouncements(Array.isArray(d) ? d : d.announcements || []))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [event, id]);

  // My QR for this event, if I'm logged in and registered.
  useEffect(() => {
    if (!user || !event) return;
    api<{ qr: { qr_code_token: string; checked_in: number | boolean } | null }>(
      `/users/me/qr-token/${event.id}`,
    )
      .then((d) => setMyQr(d.qr))
      .catch(() => {});
  }, [user, event]);

  if (notFound) {
    return (
      <div className="page">
        <div className="section-inner">
          <EmptyState
            title="Event not found"
            body="It may have been removed, or you don't have access to view it."
            action={
              <Link href="/events" className="btn-secondary btn-sm">Back to events</Link>
            }
          />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="page">
        <div className="section-inner">
          <Spinner label="Loading event" />
        </div>
      </div>
    );
  }

  const canManage = user && isCorePlus(user);
  const canAdminister = user && (isCoreHeadPlus(user) || isSuperCoreHead(user));

  return (
    <div className="page">
      <div className="section-inner section-inner-sm">
        <span className="section-eyebrow">// Event</span>
        <div className="split split-start">
          <div className="flex-1">
            <h1 className="page-title event-detail-title">{event.title}</h1>
          </div>
          <Badge variant={event.status === "published" ? "published" : event.status === "draft" ? "draft" : "completed"} dot>
            {event.status}
          </Badge>
        </div>

        <div className="cluster" style={{ margin: "16px 0 0" }}>
          {event.category && <Badge>{event.category}</Badge>}
          <Badge>{event.visibility === "member_only" ? "Members only" : "Public"}</Badge>
          {myQr?.checked_in ? <Badge variant="dark">You checked in ✓</Badge> : null}
        </div>

        {event.banner_image_url && (
          <div className="event-banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl(event.banner_image_url) || ""} alt={event.title} />
          </div>
        )}

        <div className="detail-meta">
          <div className="detail-meta-item">
            <div className="detail-meta-label">When</div>
            <div className="detail-meta-value">{formatDateRange(event.start_datetime, event.end_datetime)}</div>
            <div className="text-mono text-sm text-muted" style={{ marginTop: 4 }}>
              {formatDateTime(event.start_datetime)}
            </div>
          </div>
          <div className="detail-meta-item">
            <div className="detail-meta-label">Where</div>
            <div className="detail-meta-value">{event.venue || "BMSIT"}</div>
          </div>
          <div className="detail-meta-item">
            <div className="detail-meta-label">Registration</div>
            <div className="detail-meta-value" style={{ fontSize: 13 }}>
              {event.unstop_link ? "Online registration" : "Free / walk-in"}
            </div>
          </div>
        </div>

        <div className="cluster" style={{ marginBottom: 28 }}>
          {event.unstop_link && (
            <a className="btn-primary" href={event.unstop_link} target="_blank" rel="noopener noreferrer">
              Register now
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
          {canAdminister && (
            <Link className="btn-secondary" href={`/events/${event.id}/manage`}>
              Manage event
            </Link>
          )}
          {canManage && (
            <Link className="btn-ghost" href={`/checkin?event=${event.id}`}>
              Open check-in
            </Link>
          )}
        </div>

        <div className="card" style={{ marginBottom: 28 }}>
          <h3 className="card-title" style={{ marginBottom: 12 }}>About this event</h3>
          <p style={{ fontSize: 14.5, color: "var(--grey-600)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {event.description || "Details coming soon."}
          </p>
        </div>

        {/* My QR */}
        {user && myQr && (
          <div className="stack" style={{ marginBottom: 28 }}>
            <h3 className="card-title">My check-in pass</h3>
            <div className="qr-box">
              <QrImage value={myQr.qr_code_token} />
              {myQr.checked_in ? (
                <Badge variant="dark">Checked in ✓</Badge>
              ) : (
                <span className="text-mono text-sm text-muted" style={{ textAlign: "center" }}>
                  Show this at the door to check in.
                  <br />A Core member will scan it.
                </span>
              )}
            </div>
          </div>
        )}
        {!user && event.status === "published" && (
          <div className="card" style={{ marginBottom: 28, textAlign: "center" }}>
            <p className="card-muted" style={{ marginBottom: 14 }}>
              Registered on Unstop? Sign in with your club account to see your check-in QR.
            </p>
            <button className="btn-secondary btn-sm" onClick={() => openAuth("login")}>
              Sign in to view my QR
            </button>
          </div>
        )}

        {/* Event history */}
        {history && (history.gist || history.winners) && (
          <div className="card" style={{ marginBottom: 28 }}>
            <h3 className="card-title" style={{ marginBottom: 14 }}>How it went</h3>
            {history.gist && (
              <p style={{ fontSize: 14, color: "var(--grey-600)", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: history.winners ? 16 : 0 }}>
                {history.gist}
              </p>
            )}
            {history.winners && (
              <div>
                <div className="detail-meta-label" style={{ marginBottom: 8 }}>Winners</div>
                <p style={{ fontSize: 14, color: "var(--grey-800)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{history.winners}</p>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="stack" style={{ marginBottom: 28 }}>
            <h3 className="card-title">Leaderboard</h3>
            <div className="stack" style={{ gap: 10 }}>
              {leaderboard.map((e, i) => (
                <div className="lb-row" key={e.id}>
                  <span className={`lb-rank ${i < 3 ? "top" : ""}`}>{e.rank || i + 1}</span>
                  <span className="lb-team">{e.team_name}</span>
                  <span className="lb-score">{e.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="stack">
            <h3 className="card-title">Announcements</h3>
            <div className="stack" style={{ gap: 12 }}>
              {announcements.map((a) => (
                <div className="announce-item" key={a.id}>
                  <div className="announce-msg">{a.message}</div>
                  <div className="announce-meta">
                    {a.posted_by_name || a.author_name || "Core team"} · {formatDateTime(a.posted_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
