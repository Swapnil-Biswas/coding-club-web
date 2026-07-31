"use client";

import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import { Spinner, PageHeader } from "@/app/components/app/ui";
import AboutSection from "@/app/components/About";

export default function AboutPage() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ about: { content: string } }>("/about");
        if (!cancelled) setContent(data.about?.content ?? "");
      } catch {
        // 404 / network — fall back to the static section below.
        if (!cancelled) setContent("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      {/* The rich, editable club manifesto from the backend. */}
      <div className="section-inner">
        <PageHeader
          eyebrow="// About"
          title="More than"
          ghost="a club."
          sub="A student-run community at BMS Institute of Technology that learns by building."
        />

        {content === null && <Spinner label="Loading" />}
        {content && content.trim() ? (
          <div className="card" style={{ padding: 34 }}>
            <div
              style={{ fontSize: 16, color: "var(--grey-700)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}
            >
              {content}
            </div>
          </div>
        ) : content === "" ? null : null}
      </div>

      {/* Fallback static about section (mission + pillars + image). */}
      <AboutSection />
    </div>
  );
}
