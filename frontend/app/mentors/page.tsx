"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth";
import { isCorePlus } from "@/app/lib/roles";
import type { Mentor } from "@/app/lib/types";
import { PageHeader, Spinner, EmptyState } from "@/app/components/app/ui";
import { api, assetUrl } from "@/app/lib/api";

export default function MentorsPage() {
  const { user, ready } = useAuth();
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [error, setError] = useState("");

  const corePlus = ready ? isCorePlus(user) : false;

  useEffect(() => {
    if (!ready) return;
    api<{ mentors: Mentor[] }>("/mentors")
      .then((d) => setMentors(d.mentors || []))
      .catch(() => setError("Failed to load mentors"));
  }, [ready]);

  return (
    <div className="page">
      <div className="section-inner section-inner-wide">
        <PageHeader
          eyebrow="// Mentors"
          title="Our"
          ghost="alumni."
          sub="BMSIT Coding Club alumni now thriving across the industry — connect, learn, and grow."
        />

        {corePlus && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 28,
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(0,180,100,0.07)",
              border: "1px solid rgba(0,180,100,0.22)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#00a060",
              letterSpacing: "0.07em",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00a060",
                display: "inline-block",
              }}
            />
            CORE VIEW — Contact details visible below
          </div>
        )}

        {error && <EmptyState title="Couldn't load mentors" body={error} />}
        {!error && mentors === null && <Spinner label="Loading mentors…" />}

        {mentors !== null && mentors.length === 0 && (
          <EmptyState
            title="No mentors yet"
            body="Check back soon — we're building out the mentor directory."
          />
        )}

        {mentors && mentors.length > 0 && (
          <div className="mentors-grid">
            {mentors.map((m) => (
              <MentorCard key={m.id} mentor={m} corePlus={corePlus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MentorCard({ mentor: m, corePlus }: { mentor: Mentor; corePlus: boolean }) {
  const photoSrc: string | undefined = m.photo_url
    ? m.photo_url.startsWith("http")
      ? m.photo_url
      : (assetUrl(m.photo_url) ?? m.photo_url)
    : undefined;

  return (
    <div className="mentor-card">
      {/* Avatar */}
      <div className="mentor-avatar-wrap">
        {photoSrc ? (
          <img src={photoSrc} alt={m.name} className="mentor-avatar" />
        ) : (
          <div className="mentor-avatar mentor-avatar-placeholder">
            {m.name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mentor-body">
        <div className="mentor-name">{m.name}</div>

        {(m.current_role || m.organization) && (
          <div className="mentor-role">
            {m.current_role && <span>{m.current_role}</span>}
            {m.current_role && m.organization && (
              <span className="mentor-role-sep"> @ </span>
            )}
            {m.organization && (
              <span className="mentor-org">{m.organization}</span>
            )}
          </div>
        )}

        <p className="mentor-bio">{m.bio}</p>

        {/* Contact tier — only rendered when fields are present in the API response */}
        {corePlus && (m.linkedin_url || m.github_url || m.whatsapp_number) && (
          <div className="mentor-contact">
            {m.linkedin_url && (
              <a
                href={m.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mentor-contact-link"
                title="LinkedIn"
                aria-label={`${m.name} on LinkedIn`}
              >
                {/* LinkedIn icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
                LinkedIn
              </a>
            )}
            {m.github_url && (
              <a
                href={m.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mentor-contact-link"
                title="GitHub"
                aria-label={`${m.name} on GitHub`}
              >
                {/* GitHub icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
                GitHub
              </a>
            )}
            {m.whatsapp_number && (
              <a
                href={`https://wa.me/${m.whatsapp_number.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mentor-contact-link mentor-contact-wa"
                title="WhatsApp"
                aria-label={`Message ${m.name} on WhatsApp`}
              >
                {/* WhatsApp icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M11.5 2.004A9.497 9.497 0 0 0 2 11.5c0 1.671.436 3.235 1.197 4.594L2 22l6.094-1.196A9.49 9.49 0 0 0 11.5 21a9.5 9.5 0 0 0 0-19z" />
                </svg>
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
