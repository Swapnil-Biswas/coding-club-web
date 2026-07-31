"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, assetUrl } from "@/app/lib/api";
import type { ClubEvent } from "@/app/lib/types";
import { formatDateRange } from "@/app/lib/format";
import { Spinner, EmptyState, Tabs, PageHeader } from "@/app/components/app/ui";

function phase(ev: ClubEvent): "past" | "live" | "upcoming" {
  const now = Date.now();
  const start = new Date(ev.start_datetime).getTime();
  const end = new Date(ev.end_datetime).getTime();
  if (ev.status === "completed" || end < now) return "past";
  if (start <= now && end >= now) return "live";
  return "upcoming";
}

export default function EventsPage() {
  const [events, setEvents] = useState<ClubEvent[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ events: ClubEvent[] }>("/events");
        if (!cancelled) setEvents(data.events.filter((e) => e.status !== "draft"));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load events");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!events) return [];
    const list = events.filter((e) => {
      const p = phase(e);
      if (tab === "upcoming") return p === "upcoming" || p === "live";
      return p === "past";
    });
    list.sort((a, b) => {
      const da = new Date(a.start_datetime).getTime();
      const db = new Date(b.start_datetime).getTime();
      return tab === "upcoming" ? da - db : db - da;
    });
    return list;
  }, [events, tab]);

  const upcomingCount = events ? events.filter((e) => phase(e) !== "past").length : 0;
  const pastCount = events ? events.filter((e) => phase(e) === "past").length : 0;

  return (
    <div className="page">
      <div className="section-inner">
        <PageHeader
          eyebrow="// Events"
          title="Every build night,"
          ghost="archived."
          sub="Workshops, hackathons, sprints, and socials. Register on Unstop for upcoming events, or browse the back-catalogue."
        />

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "upcoming", label: "Upcoming", count: upcomingCount },
            { id: "past", label: "Past", count: pastCount },
          ]}
        />

        {events === null && !error && <Spinner label="Loading events" />}
        {error && <EmptyState title="Couldn't load events" body={error} />}
        {events && filtered.length === 0 && (
          <EmptyState
            title={tab === "upcoming" ? "Nothing on the calendar" : "No past events"}
            body={tab === "upcoming" ? "New events are being planned. Check back soon." : "Past events will appear here once they wrap up."}
          />
        )}

        {events && filtered.length > 0 && (
          <div className="grid grid-2">
            {filtered.map((ev) => {
              const p = phase(ev);
              return (
                <Link key={ev.id} href={`/events/${ev.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <article className="card card-hover" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14, padding: 0, overflow: "hidden" }}>
                    {ev.banner_image_url && (
                      <div style={{ aspectRatio: "21/9", background: "var(--grey-100)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={assetUrl(ev.banner_image_url) || ""} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ padding: ev.banner_image_url ? "0 24px 24px" : "24px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                      <div className="split" style={{ gap: 10 }}>
                        <span className={`badge ${p === "past" ? "status-completed" : p === "live" ? "badge-dark" : ""}`}>
                          {p === "live" && <span className="event-live-dot" style={{ marginRight: 6 }} />}
                          {ev.category || "Event"}
                        </span>
                        <span className="text-mono text-sm text-muted">{formatDateRange(ev.start_datetime, ev.end_datetime)}</span>
                      </div>
                      <h3 className="card-title">{ev.title}</h3>
                      <p className="card-muted" style={{ flex: 1 }}>{ev.description}</p>
                      <div className="split" style={{ borderTop: "1px dashed var(--grey-200)", paddingTop: 14 }}>
                        <span className="text-mono text-sm text-muted">📍 {ev.venue || "BMSIT"}</span>
                        <span className="badge">{p === "live" ? "Live" : p === "past" ? "Past" : "Details →"}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
