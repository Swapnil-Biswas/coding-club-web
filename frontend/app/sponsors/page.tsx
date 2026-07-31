"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import type { Sponsor } from "@/app/lib/types";
import { Spinner, EmptyState, PageHeader } from "@/app/components/app/ui";

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ sponsors: Sponsor[] }>("/sponsors");
        if (!cancelled) setSponsors(data.sponsors);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load sponsors");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <div className="section-inner">
        <PageHeader
          eyebrow="// Sponsors"
          title="The folks who"
          ghost="back us."
          sub="Venues, prizes, food, and the occasional cloud credit. We're grateful for every one of them."
        />

        {sponsors === null && !error && <Spinner label="Loading sponsors" />}
        {error && <EmptyState title="Couldn't load sponsors" body={error} />}
        {sponsors && sponsors.length === 0 && (
          <EmptyState
            title="Sponsor slots are open"
            body="Interested in supporting the club? Reach out via the Join page."
          />
        )}

        {sponsors && sponsors.length > 0 && (
          <div className="sponsor-grid">
            {sponsors.map((s) => (
              <a
                key={s.id}
                className="card card-hover sponsor-card"
                href={s.website || undefined}
                target={s.website ? "_blank" : undefined}
                rel="noopener noreferrer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="sponsor-logo" src={s.logo_url} alt={s.name} />
                <div>
                  <div className="card-title">{s.name}</div>
                  {s.description && <div className="card-muted" style={{ marginTop: 6 }}>{s.description}</div>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
