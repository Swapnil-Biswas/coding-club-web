"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isAdmin, isFaculty } from "@/app/lib/roles";
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

const ROLE_ORDER: Role[] = ["admin", "core_head", "core", "member", "public", "faculty"];

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
        <EmptyState title="Sign in required" body="The members panel is visible to all club members." action={<button className="btn-primary" onClick={() => openAuth("login")}>Sign in</button>} />
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
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const admin = isAdmin(viewer);
  const faculty = isFaculty(viewer);
  const coreHead = viewer.role === 'core_head'; // pure core_head (not admin)
  const canManage = admin || coreHead;           // both can promote/demote

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
      setActionMsg(`${target.name} is now ${role === "core_head" ? "Core Head" : role === "faculty" ? "Faculty" : role}.`);
      await load();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(target: AdminUser) {
    setActionErr("");
    setActionMsg("");
    setBusyId(target.id);
    setDeleteTarget(null);
    try {
      await api(`/users/${target.id}`, { method: "DELETE" });
      setActionMsg(`${target.name}'s account has been deleted.`);
      await load();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
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
      // Non-managers never see admin accounts (backend already strips them from the
      // slim list, but this guards against any future shape change).
      .filter((u) => canManage || u.role !== "admin")
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      .sort((a, b) => {
        // Special titles pin to the very top: President → 0, Vice President → 1
        const titleRank = (t?: string | null) =>
          t === "President" ? 0 : t === "Vice President" ? 1 : 2;
        const ta = titleRank(a.club_title);
        const tb = titleRank(b.club_title);
        if (ta !== tb) return ta - tb;
        // Then sort by role hierarchy
        const ai = ROLE_ORDER.indexOf(a.role as Role);
        const bi = ROLE_ORDER.indexOf(b.role as Role);
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        // Finally alphabetical by name within the same rank
        return a.name.localeCompare(b.name);
      });
  }, [users, tab, query, canManage]);

  return (
    <div className="page">
      <div className="section-inner section-inner-wide">
        <PageHeader
          eyebrow="// Members"
          title="People &"
          ghost="roles."
          sub={
            admin
              ? "Promote, demote, assign Faculty status, and manage accounts."
              : coreHead
              ? "Promote/demote within Public ↔ Member ↔ Core. Admins handle Core Head and above."
              : faculty
              ? "You are viewing as a Faculty observer (read-only)."
              : "View all club members and their roles."
          }
          actions={
            <input
              className="input compact-search"
              placeholder={admin ? "Search name or email…" : "Search name…"}
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
          tabs={[
            { id: "all", label: "All", count: counts.all },
            ...ROLE_ORDER.map((r) => ({
              id: r,
              label: r === "core_head" ? "Core Head" : r.charAt(0).toUpperCase() + r.slice(1),
              count: counts[r] || 0,
            })),
          ]}
        />

        {users === null && !error && <Spinner label="Loading members" />}
        {error && <EmptyState title="Couldn't load members" body={error} />}

        {users && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  {canManage && <th>Email</th>}
                  <th>Role</th>
                  {admin && <th>Verified</th>}
                  <th>Joined</th>
                  {canManage && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: "var(--grey-900)" }}>
                      {u.name}
                      {u.id === viewer.id && <span className="text-mono text-sm text-muted"> (you)</span>}
                    </td>
                    {canManage && <td className="text-mono text-sm">{u.email}</td>}
                    <td>
                      {/* President / Vice President get a special title badge.
                          canManage viewers also see the underlying Core Head chip. */}
                      {(u.club_title === "President" || u.club_title === "Vice President") ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span
                            className="role-chip"
                            style={{
                              background: u.club_title === "President"
                                ? "linear-gradient(135deg,#b8860b,#ffd700)"
                                : "linear-gradient(135deg,#5a7fa8,#8ab4d8)",
                              color: "#fff",
                              fontWeight: 700,
                              letterSpacing: "0.03em",
                            }}
                          >
                            {u.club_title}
                          </span>
                          {canManage && <RoleChip role={u.role} />}
                        </span>
                      ) : (
                        <RoleChip role={u.role} />
                      )}
                    </td>
                    {admin && <td>{u.email_verified ? "Yes" : "No"}</td>}
                    <td className="text-sm text-muted">{formatDate(u.created_at)}</td>
                    {canManage && (
                      <td>
                        {u.is_seeded_admin ? (
                          // Root admin — permanently protected, no actions allowed
                          <span style={{ fontSize: 11, color: "var(--grey-400)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            root
                          </span>
                        ) : (
                          <div className="table-actions">

                            {/* ── core_head scope: public ↔ member ↔ core ── */}
                            {coreHead && u.role === "public" && (
                              <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "member")}>
                                ↑ Member
                              </ActionButton>
                            )}
                            {coreHead && u.role === "member" && (
                              <>
                                <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "core")}>
                                  ↑ Core
                                </ActionButton>
                                <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "public")}>
                                  ↓ Public
                                </ActionButton>
                              </>
                            )}
                            {coreHead && u.role === "core" && (
                              <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "member")}>
                                ↓ Member
                              </ActionButton>
                            )}

                            {/* ── admin scope: full hierarchy ── */}
                            {admin && u.role === "public" && (
                              <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "member")}>
                                ↑ Member
                              </ActionButton>
                            )}
                            {admin && u.role === "member" && (
                              <>
                                <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "core")}>
                                  ↑ Core
                                </ActionButton>
                                <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "public")}>
                                  ↓ Public
                                </ActionButton>
                              </>
                            )}
                            {admin && u.role === "core" && (
                              <>
                                <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "core_head")}>
                                  ↑ Core Head
                                </ActionButton>
                                <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "member")}>
                                  ↓ Member
                                </ActionButton>
                              </>
                            )}
                            {admin && u.role === "core_head" && (
                              <>
                                <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "admin")}>
                                  ↑ Admin
                                </ActionButton>
                                <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "core")}>
                                  ↓ Core
                                </ActionButton>
                              </>
                            )}
                            {/* Admin row: demote only (not self, not seeded — already handled above) */}
                            {admin && u.role === "admin" && u.id !== viewer.id && (
                              <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "core_head")}>
                                ↓ Core Head
                              </ActionButton>
                            )}

                            {/* ── Faculty (admin only) ── */}
                            {admin && u.id !== viewer.id && u.role !== "faculty" && u.role !== "admin" && (
                              <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "faculty")}>
                                → Faculty
                              </ActionButton>
                            )}
                            {admin && u.role === "faculty" && (
                              <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "member")}>
                                Remove Faculty
                              </ActionButton>
                            )}

                            {/* ── Delete (admin only, never yourself) ── */}
                            {admin && u.id !== viewer.id && (
                              <button
                                title={`Delete ${u.name}'s account`}
                                disabled={busyId === u.id}
                                onClick={() => setDeleteTarget(u)}
                                style={{
                                  background: "none",
                                  border: "1.5px solid rgba(192,57,43,0.3)",
                                  borderRadius: 8,
                                  padding: "5px 7px",
                                  cursor: "pointer",
                                  color: "#c0392b",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: busyId === u.id ? 0.4 : 1,
                                  transition: "background 0.15s, border-color 0.15s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(192,57,43,0.08)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "none")}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>
                            )}

                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={canManage ? (admin ? 6 : 5) : 3} style={{ textAlign: "center", color: "var(--grey-400)", padding: 32 }}>No members match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {deleteTarget && (
        <ConfirmDeleteModal
          user={deleteTarget}
          busy={busyId === deleteTarget.id}
          onConfirm={() => deleteUser(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
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

function ConfirmDeleteModal({
  user,
  busy,
  onConfirm,
  onCancel,
}: {
  user: AdminUser;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning icon */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(192,57,43,0.1)",
              color: "#c0392b",
              fontSize: 24,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
        </div>

        <h2
          className="modal-title"
          style={{ textAlign: "center", fontSize: 22, marginBottom: 8 }}
        >
          Delete account?
        </h2>
        <p
          className="modal-sub"
          style={{ textAlign: "center", marginBottom: 20 }}
        >
          This will permanently delete{" "}
          <strong style={{ color: "var(--grey-900)" }}>{user.name}</strong>
          &apos;s account{" "}
          <span
            className="text-mono"
            style={{ fontSize: 12, color: "var(--grey-500)" }}
          >
            {user.email ? `(${user.email})` : ""}
          </span>
          .<br />
          <span style={{ color: "#c0392b", fontWeight: 600 }}>
            This cannot be undone.
          </span>
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-secondary btn-block"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="btn-danger btn-block"
            onClick={onConfirm}
            disabled={busy}
            style={{ fontWeight: 700 }}
          >
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
