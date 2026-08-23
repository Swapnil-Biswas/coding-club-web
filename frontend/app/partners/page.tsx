"use client";

import { useEffect, useState } from "react";
import { api, assetUrl } from "@/app/lib/api";
import type { Sponsor } from "@/app/lib/types";
import { Spinner, EmptyState, PageHeader } from "@/app/components/app/ui";

export default function PartnersPage() {
  const [partners, setPartners] = useState<Sponsor[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ sponsors: Sponsor[] }>("/sponsors");
        if (!cancelled) setPartners(data.sponsors);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load partners");
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
          eyebrow="// Partners"
          title="The folks who"
          ghost="back us."
          sub="Organizations, communities, and companies that support our mission. We're grateful for every one of them."
        />

        {partners === null && !error && <Spinner label="Loading partners" />}
        {error && <EmptyState title="Couldn't load partners" body={error} />}
        {partners && partners.length === 0 && (
          <EmptyState
            title="Partner slots are open"
            body="Interested in partnering with the club? Reach out via the Join page."
          />
        )}

        {partners && partners.length > 0 && (
          <div className="sponsor-grid">
            {partners.map((p) => (
              <a
                key={p.id}
                className="card card-hover sponsor-card"
                href={p.website || undefined}
                target={p.website ? "_blank" : undefined}
                rel="noopener noreferrer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="sponsor-logo" src={assetUrl(p.logo_url) || ""} alt={p.name} />
                <div>
                  <div className="card-title">{p.name}</div>
                  {p.description && <div className="card-muted" style={{ marginTop: 6 }}>{p.description}</div>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
