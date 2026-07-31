"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/app/lib/api";
import type { ClubEvent } from "@/app/lib/types";
import { formatDateRange } from "@/app/lib/format";
import RevealOnScroll from "./RevealOnScroll";
import Ticker from "./Ticker";
import GlyphDivider from "./GlyphDivider";
import { Spinner, EmptyState } from "./app/ui";

function eventPhase(ev: ClubEvent): "past" | "live" | "upcoming" {
  const now = Date.now();
  const start = new Date(ev.start_datetime).getTime();
  const end = new Date(ev.end_datetime).getTime();
  if (Number.isNaN(start)) return "upcoming";
  if (ev.status === "completed" || end < now) return "past";
  if (start <= now && end >= now) return "live";
  return "upcoming";
}

export default function Events() {
  const [events, setEvents] = useState<ClubEvent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ events: ClubEvent[] }>("/events");
        if (cancelled) return;
        // Only show published events on the landing highlight; upcoming first.
        const published = data.events.filter((e) => e.status === "published");
        published.sort((a, b) => {
          const pa = eventPhase(a) === "live" ? 0 : eventPhase(a) === "upcoming" ? 1 : 2;
          const pb = eventPhase(b) === "live" ? 0 : eventPhase(b) === "upcoming" ? 1 : 2;
          if (pa !== pb) return pa - pb;
          return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
        });
        setEvents(published.slice(0, 4));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load events");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tickerItems =
    events && events.length
      ? events.map((e) => `${e.title.toUpperCase()} · ${e.venue ? e.venue.toUpperCase() : "BMSIT"}`)
      : ["CODING CLUB BMSIT", "HACKATHONS · WORKSHOPS · BUILD NIGHTS", "LEARN BY SHIPPING"];

  return (
    <section className="events" id="events">
      <div className="events-ticker-wrap">
        <Ticker items={tickerItems} speed={3.5} />
      </div>

      <div className="events-inner">
        <RevealOnScroll className="events-header">
          <span className="section-eyebrow">// 02 — What&apos;s on</span>
          <h2 className="section-heading">
            Events that
            <br />
            <span className="events-heading-ghost">actually</span> matter.
          </h2>
          <p className="section-body events-sub">
            Hackathons, workshops, build nights, and the occasional rooftop hang.
            Every event runs on members, for members.
          </p>
        </RevealOnScroll>

        <GlyphDivider label="UPCOMING" />

        {events === null && !error && <Spinner label="Loading events" />}
        {error && (
          <EmptyState title="Couldn't load events" body={error} />
        )}
        {events && events.length === 0 && (
          <EmptyState
            title="No public events yet"
            body="New events are being planned. Check back soon, or join the club to hear first."
          />
        )}

        {events && events.length > 0 && (
          <>
            <div className="events-grid">
              {events.map((ev, i) => {
                const phase = eventPhase(ev);
                return (
                  <RevealOnScroll key={ev.id} delay={i * 90}>
                    <article className="event-card">
                      <div className="event-card-glyphs" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="event-card-top">
                        <span className={`event-tag tag-${phase === "live" ? "live" : "upcoming"}`}>
                          {phase === "live" && <span className="event-live-dot" />}
                          {ev.category || "Event"}
                        </span>
                        <span className="event-date">
                          {formatDateRange(ev.start_datetime, ev.end_datetime)}
                        </span>
                      </div>
                      <h3 className="event-title">{ev.title}</h3>
                      <p className="event-blurb">{ev.description}</p>
                      <div className="event-meta">
                        <span className="event-loc">
                          <span className="event-loc-dot" /> {ev.venue || "BMSIT"}
                        </span>
                        <span className={`event-count`}>
                          {phase === "live" ? "Happening now" : phase === "past" ? "Past" : "Upcoming"}
                        </span>
                      </div>
                      <div className="event-card-bottom">
                        {phase !== "past" ? (
                          <Countdown to={ev.start_datetime} />
                        ) : (
                          <span className="event-date">Concluded</span>
                        )}
                        <Link className="event-cta" href={`/events/${ev.id}`}>
                          Details
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </Link>
                      </div>
                    </article>
                  </RevealOnScroll>
                );
              })}
            </div>
            <div className="projects-more">
              <Link href="/events" className="btn-secondary">
                View all events
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// Lazily initialized on the client (component is client-only), so we render a
// real value on first paint without an SSR/client hydration mismatch.
function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="event-countdown" aria-hidden="true">
        <span>--</span>
        <span>--</span>
        <span>--</span>
        <span>--</span>
      </div>
    );
  }
  const target = new Date(to).getTime();
  const diff = Math.max(0, target - now.getTime());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return (
    <div className="event-countdown" aria-label="Time until event">
      <span><b>{String(d).padStart(2, "0")}</b><i>d</i></span>
      <span><b>{String(h).padStart(2, "0")}</b><i>h</i></span>
      <span><b>{String(m).padStart(2, "0")}</b><i>m</i></span>
      <span><b>{String(s).padStart(2, "0")}</b><i>s</i></span>
    </div>
  );
}
