"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, assetUrl } from "@/app/lib/api";
import type { Team, TeamMember } from "@/app/lib/types";
import RevealOnScroll from "./RevealOnScroll";
import GlyphDivider from "./GlyphDivider";
import { Spinner, EmptyState } from "./app/ui";

interface FlatMember {
  user_id: number;
  name: string;
  title: string; // club_title or designation or '<role>'
  team: string;
  photo: string | null;
}

export default function TeamSection({ preview = true }: { preview?: boolean }) {
  const [teams, setTeams] = useState<(Team & { members: TeamMember[] })[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<{ teams: Team[] }>("/teams");
        const withMembers = await Promise.all(
          list.teams.map(async (t) => {
            try {
              const det = await api<{ team: Team; members: TeamMember[] }>(`/teams/${t.id}`);
              return { ...t, members: det.members };
            } catch {
              return { ...t, members: [] as TeamMember[] };
            }
          }),
        );
        if (!cancelled) setTeams(withMembers);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load team");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const members = useMemo<FlatMember[]>(() => {
    if (!teams) return [];
    const seen = new Map<number, FlatMember>();
    for (const t of teams) {
      for (const m of t.members) {
        // Only show Core / Core Head / admin on the public grid.
        if (!["core", "core_head", "admin"].includes(m.role)) continue;
        const title = m.role === "core_head" ? m.club_title || "Core Head" : m.designation || "Core";
        if (!seen.has(m.user_id)) {
          seen.set(m.user_id, {
            user_id: m.user_id,
            name: m.name,
            title,
            team: t.name,
            photo: m.profile_photo_url,
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [teams]);

  const shown = preview ? members.slice(0, 8) : members;

  return (
    <section className="team" id="team">
      <div className="team-inner">
        <RevealOnScroll className="team-header">
          <span className="section-eyebrow">// 04 — The humans</span>
          <h2 className="section-heading">
            Core team,
            <br />
            <span className="team-heading-ghost">no suits.</span>
          </h2>
          <p className="section-body team-sub">
            The students running the show. None of us are paid. All of us are,
            in some technical sense, slightly unwell about code.
          </p>
        </RevealOnScroll>

        <GlyphDivider label="CORE" />

        {teams === null && !error && <Spinner label="Loading team" />}
        {error && <EmptyState title="Couldn't load the team" body={error} />}
        {teams && shown.length === 0 && (
          <EmptyState title="Team coming together" body="Our core team roster is being assembled." />
        )}

        {teams && shown.length > 0 && (
          <>
            <div className="team-grid">
              {shown.map((m, i) => (
                <RevealOnScroll key={m.user_id} delay={i * 60}>
                  <article className="team-card card-hover" style={{ textAlign: "center" }}>
                    <div className="member-avatar">
                      {m.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetUrl(m.photo) || ""} alt={m.name} />
                      ) : (
                        initials(m.name)
                      )}
                    </div>
                    <div className="team-info">
                      <span className="team-role">{m.title}</span>
                      <h3 className="team-name">{m.name}</h3>
                      <span className="team-year">{m.team}</span>
                    </div>
                    <div className="team-card-line" aria-hidden="true" />
                  </article>
                </RevealOnScroll>
              ))}
            </div>
            {preview && (
              <div className="projects-more">
                <Link href="/teams" className="btn-secondary">
                  Meet the full team
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
