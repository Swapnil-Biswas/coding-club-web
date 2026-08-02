"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isAdmin } from "@/app/lib/roles";
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
  if (!user || user.role === 'public') {
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
  const coreHead = viewer.role === 'core_head' || admin; // core_head can promote member→core

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
          sub={admin ? "Promote, demote, and manage every account." : coreHead ? "Core Heads can promote Members to Core." : "View all club members and their roles."}
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
                        {/* core_head: member → core only */}
                        {coreHead && !admin && u.role === "member" && (
                          <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "core")}>
                            → Core
                          </ActionButton>
                        )}
                        {/* admin: full control */}
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
                          <>
                            <ActionButton busy={busyId === u.id} onClick={() => changeRole(u, "admin")}>
                              → Admin
                            </ActionButton>
                            <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "core")}>
                              → Core
                            </ActionButton>
                          </>
                        )}
                        {admin && u.role === "admin" && u.id !== viewer.id && (
                          <ActionButton danger busy={busyId === u.id} onClick={() => changeRole(u, "core_head")}>
                            → Core Head
                          </ActionButton>
                        )}
                        {/* Delete — admin only, never yourself */}
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
            ⚠
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
            ({user.email})
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
