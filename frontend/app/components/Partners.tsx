"use client";

import { useEffect, useState } from "react";
import { api, assetUrl } from "@/app/lib/api";
import type { Sponsor } from "@/app/lib/types";
import RevealOnScroll from "./RevealOnScroll";
import GlyphDivider from "./GlyphDivider";
import { Spinner } from "./app/ui";

export default function PartnersSection() {
  const [partners, setPartners] = useState<Sponsor[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ sponsors: Sponsor[] }>("/sponsors");
        if (!cancelled) setPartners(data.sponsors);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the whole section if there are no partners and nothing failed.
  if (partners && partners.length === 0) return null;

  return (
    <section className="domains" id="partners" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="domains-inner">
        <RevealOnScroll className="domains-header">
          <span className="section-eyebrow">// Backed by</span>
          <h2 className="section-heading domains-heading">
            Our <span className="domains-heading-ghost">partners.</span>
          </h2>
        </RevealOnScroll>

        {partners === null && !error && <Spinner label="Loading partners" />}
        {error && <p className="card-muted" style={{ textAlign: "center" }}>{error}</p>}

        {partners && partners.length > 0 && (
          <div className="sponsor-grid">
            {partners.map((p, i) => (
              <RevealOnScroll key={p.id} delay={i * 70}>
                <a
                  className="card card-hover sponsor-card"
                  href={p.website || undefined}
                  target={p.website ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="sponsor-logo" src={assetUrl(p.logo_url) || ""} alt={p.name} />
                  <div>
                    <div className="card-title" style={{ fontSize: 17 }}>{p.name}</div>
                    {p.description && <div className="card-muted" style={{ marginTop: 6 }}>{p.description}</div>}
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
