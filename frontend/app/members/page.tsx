"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isCorePlus, isAdmin } from "@/app/lib/roles";
import type { AdminUser, PublicUser, Role } from "@/app/lib/types";
import { formatDate } from "@/app/lib/format";
import {
  PageHeader,
  Spinner,
  EmptyState,
  RoleChip,
  Tabs,
  FormError,
  FormSuccess,
} from "@/app/components/app/ui";

const ROLE_ORDER: Role[] = ["admin", "core_head", "core", "member", "public"];

export default function MembersPage() {
  const { user, ready, openAuth } = useAuth();

  if (!ready) {
    return (
      <div className="page"><div className="section-inner"><Spinner /></div></div>
    );
  }
  if (!user) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Sign in required" body="The members panel is only visible to Core and above." action={<button className="btn-primary" onClick={() => openAuth("login")}>Sign in</button>} />
      </div></div>
    );
  }
  if (!isCorePlus(user)) {
    return (
      <div className="page"><div className="section-inner">
        <EmptyState title="Core & above only" body="You need to be a Core member to view the members panel." />
      </div></div>
    );
  }

  return <MembersInner viewer={user} />;
}

function MembersInner({ viewer }: { viewer: PublicUser }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const admin = isAdmin(viewer);
  const core = viewer.role === "core" || admin; // core (and admin) can promote public→member

  async function load() {
    try {
      const data = await api<{ users: AdminUser[] }>("/users");
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function changeRole(target: AdminUser, role: Role) {
    setActionErr("");
    setActionMsg("");
    setBusyId(target.id);
    try {
      await api(`/users/${target.id}/role`, { method: "PATCH", body: { role } });
      setActionMsg(`${target.name} is now ${role === "core_head" ? "Core Head" : role}.`);
      await load();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users?.length || 0 };
    for (const r of ROLE_ORDER) c[r] = 0;
    for (const u of users || []) c[u.role] = (c[u.role] || 0) + 1;
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    return users
      .filter((u) => (tab === "all" ? true : u.role === tab))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  }, [users, tab, query]);

  return (
    <div className="page">
      <div className="section-inner section-inner-wide">
        <PageHeader
          eyebrow="// Members"
          title="People &"
          ghost="roles."
          sub={admin ? "Promote, demote, and manage every account." : "Verified members and club hierarchy. Core can promote public → member."}
          actions={
            <input
              className="input"
              style={{ width: 240 }}
              placeholder="Search name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          }
        />

        <FormSuccess>{actionMsg}</FormSuccess>
        <FormError>{actionErr}</FormError>

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[{ id: "all", label: "All", count: counts.all }, ...ROLE_ORDER.map((r) => ({ id: r, label: r === "core_head" ? "Core Head" : r.charAt(0).toUpperCase() + r.slice(1), count: counts[r] || 0 }))]}
        />

        {users === null && !error && <Spinner label="Loading members" />}
        {error && <EmptyState title="Couldn't load members" body={error} />}

        {users && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: "var(--grey-900)" }}>
                      {u.name}
                      {u.id === viewer.id && <span className="text-mono text-sm text-muted"> (you)</span>}
                    </td>
                    <td className="text-mono text-sm">{u.email}</td>
                    <td><RoleChip role={u.role} /></td>
                    <td>{u.email_verified ? "Yes" : "No"}</td>
                    <td className="text-sm text-muted">{formatDate(u.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        {core && u.role === "public" && (
                          <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "member")}>
                            → Member
                          </ActionButton>
                        )}
                        {admin && u.role === "member" && (
                          <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "core")}>
                            → Core
                          </ActionButton>
                        )}
                        {admin && u.role === "core" && (
                          <>
                            <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "core_head")}>
                              → Core Head
                            </ActionButton>
                            <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "member")}>
                              → Member
                            </ActionButton>
                          </>
                        )}
                        {admin && u.role === "core_head" && (
                          <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "core")}>
                            → Core
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--grey-400)", padding: 32 }}>No members match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={`btn-sm ${danger ? "btn-danger" : "btn-secondary"}`}
      onClick={onClick}
      disabled={busy}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {busy ? "…" : children}
    </button>
  );
}
