"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import type { Sponsor } from "@/app/lib/types";
import RevealOnScroll from "./RevealOnScroll";
import GlyphDivider from "./GlyphDivider";
import { Spinner } from "./app/ui";

export default function SponsorsSection() {
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ sponsors: Sponsor[] }>("/sponsors");
        if (!cancelled) setSponsors(data.sponsors);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the whole section if there are no sponsors and nothing failed.
  if (sponsors && sponsors.length === 0) return null;

  return (
    <section className="domains" id="sponsors" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="domains-inner">
        <RevealOnScroll className="domains-header">
          <span className="section-eyebrow">// Backed by</span>
          <h2 className="section-heading domains-heading">
            Our <span className="domains-heading-ghost">sponsors.</span>
          </h2>
        </RevealOnScroll>

        {sponsors === null && !error && <Spinner label="Loading sponsors" />}
        {error && <p className="card-muted" style={{ textAlign: "center" }}>{error}</p>}

        {sponsors && sponsors.length > 0 && (
          <div className="sponsor-grid">
            {sponsors.map((s, i) => (
              <RevealOnScroll key={s.id} delay={i * 70}>
                <a
                  className="card card-hover sponsor-card"
                  href={s.website || undefined}
                  target={s.website ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="sponsor-logo" src={s.logo_url} alt={s.name} />
                  <div>
                    <div className="card-title" style={{ fontSize: 17 }}>{s.name}</div>
                    {s.description && <div className="card-muted" style={{ marginTop: 6 }}>{s.description}</div>}
                  </div>
                </a>
              </RevealOnScroll>
            ))}
          </div>
        )}

        <GlyphDivider variant="compact" />
      </div>
    </section>
  );
}
