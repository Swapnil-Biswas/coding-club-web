"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import type { AppNotification } from "@/app/lib/types";
import { formatDateTime } from "@/app/lib/format";

export default function NotificationsBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api<{ count: number }>("/notifications/me/notifications/unread-count");
      setUnread(data.count);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    fetchUnread();
    if (!user) return;
    const id = setInterval(fetchUnread, 15000);
    return () => clearInterval(id);
  }, [fetchUnread, user]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && user) {
      setLoading(true);
      try {
        const data = await api<AppNotification[] | { notifications?: AppNotification[] }>(
          "/notifications/me/notifications",
        );
        setItems(Array.isArray(data) ? data : data.notifications || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
  }

  async function markAll() {
    if (!user) return;
    try {
      await api("/notifications/me/notifications/mark-all-read", { method: "POST" });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      /* ignore */
    }
  }

  async function openItem(n: AppNotification) {
    if (!n.is_read) {
      api(`/notifications/me/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  if (!user) return null;

  return (
    <div className="account-menu" ref={ref} style={{ position: "relative" }}>
      <button className="icon-btn" onClick={toggle} aria-label={`Notifications, ${unread} unread`}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="dropdown notifications-dropdown">
          <div className="split notifications-dropdown-header" style={{ padding: "8px 12px 10px", borderBottom: "1px solid var(--grey-100)", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--grey-900)" }}>Notifications</span>
            {unread > 0 && (
              <button className="btn-ghost btn-sm" onClick={markAll} style={{ fontSize: 10, padding: "4px 10px" }}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading && <div className="loading-row" style={{ padding: 24 }}><span className="spinner" /></div>}
            {!loading && items.length === 0 && (
              <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--grey-400)" }}>
                You&apos;re all caught up.
              </div>
            )}
            {!loading &&
              items.map((n) => (
                <button
                  key={n.id}
                  className="dropdown-item"
                  onClick={() => openItem(n)}
                  style={{
                    alignItems: "flex-start",
                    flexDirection: "column",
                    gap: 3,
                    opacity: n.is_read ? 0.66 : 1,
                    whiteSpace: "normal",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
                    {!n.is_read && (
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--grey-900)", flexShrink: 0 }} />
                    )}
                    <span style={{ minWidth: 0, overflowWrap: "anywhere", fontWeight: 600, fontSize: 12, color: "var(--grey-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {n.type}
                    </span>
                  </span>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13, color: "var(--grey-800)", lineHeight: 1.45, fontWeight: 400 }}>{n.message}</span>
                  <span style={{ fontSize: 10, color: "var(--grey-400)", fontFamily: "var(--font-mono)" }}>{formatDateTime(n.created_at)}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
