"use client";

import { useEffect, useState } from "react";
import { api, assetUrl } from "@/app/lib/api";
import type { Team, TeamMember } from "@/app/lib/types";
import { Spinner, EmptyState, Badge } from "@/app/components/app/ui";
import { PageHeader } from "@/app/components/app/ui";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ teams: Team[] }>("/teams");
        if (!cancelled) setTeams(data.teams);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load teams");
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
          eyebrow="// The club"
          title="Teams. People."
          ghost="The whole crew."
          sub="Every team is run by a Core Head. Core members can belong to many teams — that's how work actually gets done."
        />

        {teams === null && !error && <Spinner label="Loading teams" />}
        {error && <EmptyState title="Couldn't load teams" body={error} />}
        {teams && teams.length === 0 && (
          <EmptyState title="No teams yet" body="Teams are being set up by the core heads." />
        )}

        <div className="stack-lg">
          {teams?.map((t) => (
            <TeamBlock key={t.id} team={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TeamBlock({ team }: { team: Team }) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ members: TeamMember[] }>(`/teams/${team.id}/members`);
        if (!cancelled) setMembers(data.members);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="split split-start" style={{ marginBottom: members && members.length > 0 ? 22 : 0 }}>
        <div className="cluster" style={{ gap: 16 }}>
          {team.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="team-logo" src={team.logo_url} alt="" />
          ) : (
            <div className="team-logo" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--grey-500)", fontSize: 18 }}>
              {team.name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="card-title" style={{ fontSize: 22 }}>{team.name}</h3>
            {team.description && <p className="card-muted" style={{ marginTop: 4, maxWidth: 560 }}>{team.description}</p>}
          </div>
        </div>
        {team.owner_name && (
          <Badge variant="dark">Lead · {team.owner_name}</Badge>
        )}
      </div>

      {members === null && <Spinner label="" />}
      {members && members.length > 0 && (
        <div className="grid grid-4">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  const title = member.club_title || member.designation || (member.role === "core_head" ? "Core Head" : "Core");
  return (
    <div className="card card-hover" style={{ padding: 22, textAlign: "center" }}>
      <div className="member-avatar">
        {member.profile_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(member.profile_photo_url) || ""} alt={member.name} />
        ) : (
          member.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
        )}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--grey-400)" }}>
        {title}
      </div>
      <div className="team-name" style={{ marginTop: 5 }}>{member.name}</div>
      {member.designation && member.club_title && (
        <div className="text-mono text-sm text-muted" style={{ marginTop: 3 }}>{member.designation}</div>
      )}
    </div>
  );
}
