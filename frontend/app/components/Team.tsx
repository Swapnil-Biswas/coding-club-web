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
  role: string;
  club_title: string | null;
  title: string; // club_title or designation or '<role>'
  team: string;
  photo: string | null;
  display_order: number;
  created_at?: string | null;
}

export default function TeamSection({ preview = true }: { preview?: boolean }) {
  const [members, setMembers] = useState<FlatMember[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try dedicated public core & leadership endpoint first
        try {
          const res = await api<{ members: any[] }>("/teams/core/members");
          if (!cancelled && Array.isArray(res.members) && res.members.length > 0) {
            const parsed: FlatMember[] = res.members.map((m) => ({
              user_id: m.user_id,
              name: m.name,
              role: m.role,
              club_title: m.club_title || null,
              title:
                m.club_title === "President"
                  ? "President"
                  : m.club_title === "Vice President"
                  ? "Vice President"
                  : m.role === "core_head"
                  ? m.club_title || (m.designation && m.designation !== "Associate" ? m.designation : "Core Head")
                  : m.designation || "Core",
              team: m.team_name || "Core Team",
              photo: m.profile_photo_url || null,
              display_order: m.display_order || 0,
              created_at: m.created_at || null,
            }));
            setMembers(parsed);
            return;
          }
        } catch {
          // fallback to /teams listing below
        }

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
        if (cancelled) return;
        const seen = new Map<number, FlatMember>();
        for (const t of withMembers) {
          for (const m of t.members) {
            if (!["core", "core_head", "admin"].includes(m.role)) continue;
            const title =
              m.club_title === "President"
                ? "President"
                : m.club_title === "Vice President"
                ? "Vice President"
                : m.role === "core_head"
                ? m.club_title || "Core Head"
                : m.designation || "Core";
            if (!seen.has(m.user_id)) {
              seen.set(m.user_id, {
                user_id: m.user_id,
                name: m.name,
                role: m.role,
                club_title: m.club_title || null,
                title,
                team: t.name,
                photo: m.profile_photo_url,
                display_order: m.display_order || 0,
                created_at: m.joined_at || null,
              });
            }
          }
        }
        setMembers(Array.from(seen.values()));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load team");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedMembers = useMemo<FlatMember[]>(() => {
    if (!members) return [];
    return [...members].sort((a, b) => {
      const getRank = (m: FlatMember) => {
        const title = (m.club_title || m.title || "").trim().toLowerCase();
        if (title === "president") return 0;
        if (title === "vice president" || title === "vice-president") return 1;
        if (title === "secretary") return 2;
        if (title === "treasurer") return 3;
        if (m.role === "core_head" || m.role === "admin") return 4;
        if (m.role === "core") return 5;
        return 6;
      };
      const ra = getRank(a);
      const rb = getRank(b);
      if (ra !== rb) return ra - rb;

      // Within Core tier (rank 5): sort strictly by registration date (earliest first)
      if (ra === 5) {
        if (a.created_at && b.created_at) {
          const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          if (diff !== 0) return diff;
        }
        return a.name.localeCompare(b.name);
      }

      // For Core Heads: display_order, then registration date, then name
      if (ra === 4) {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        if (a.created_at && b.created_at) {
          const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          if (diff !== 0) return diff;
        }
        return a.name.localeCompare(b.name);
      }

      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });
  }, [members]);

  const shown = preview ? sortedMembers.slice(0, 8) : sortedMembers;

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

        {members === null && !error && <Spinner label="Loading team" />}
        {error && <EmptyState title="Couldn't load the team" body={error} />}
        {members && shown.length === 0 && (
          <EmptyState title="Team coming together" body="Our core team roster is being assembled." />
        )}

        {members && shown.length > 0 && (
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
