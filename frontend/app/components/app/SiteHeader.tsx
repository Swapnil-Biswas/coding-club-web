"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";
import { assetUrl } from "@/app/lib/api";
import { isCorePlus, isCoreHeadPlus, isFaculty, displayTitle } from "@/app/lib/roles";
import NotificationsBell from "./Notifications";
import { Avatar } from "./ui";

const publicLinks = [
  { label: "EVENTS",   href: "/events" },
  { label: "TEAM",     href: "/teams" },
  { label: "MENTORS",  href: "/mentors" },
  { label: "GALLERY",  href: "/gallery" },
  { label: "PARTNERS", href: "/partners" },
  { label: "ABOUT",    href: "/about" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <header
      className="header"
      style={{ borderBottomColor: scrolled ? "var(--grey-100)" : "transparent" }}
    >
      <Link href="/" className="header-logo" id="header-logo">
        <span className="header-logo-cc">CC</span>
        <span className="header-logo-text">CODING CLUB</span>
      </Link>

      <nav className="header-nav" id="header-nav">
        {publicLinks.map((l) => (
          <Link key={l.label} href={l.href} className="header-nav-link">
            {l.label}
          </Link>
        ))}
        <AuthZone />
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Mobile: show bell + account icon too */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          id="mobile-menu-toggle"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </header>
  );
}

/* Right side of the header: bell + account dropdown, or a Sign-in button. */
function AuthZone() {
  const { user, ready, openAuth } = useAuth();

  if (!ready) return <span style={{ width: 90 }} />;

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/join" className="header-nav-link">
          JOIN US
        </Link>
        <button className="header-cta" onClick={() => openAuth("login")} id="nav-signin">
          SIGN IN
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href="/join" className="header-nav-link">
        JOIN US
      </Link>
      <NotificationsBell />
      <AccountMenu />
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!user) return null;

  const corePlus = isCorePlus(user);
  const coreHeadPlus = isCoreHeadPlus(user);
  const facultyUser = isFaculty(user);

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="account-menu" ref={ref}>
      <button className="account-trigger" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={user.name} src={assetUrl(user.profile_photo_url)} />
        <span className="account-name">{user.name.split(" ")[0]}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: "var(--grey-400)" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="dropdown-header">
            <div className="dropdown-name">{user.name}</div>
            <div className="dropdown-email">{user.email}</div>
            <div style={{ marginTop: 6 }}>
              <span className="badge badge-dark" style={{ fontSize: 9 }}>
                {displayTitle(user)}
              </span>
            </div>
          </div>
          <Link href="/account" className="dropdown-item" onClick={() => setOpen(false)}>
            <MenuIcon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" extra={<circle cx="12" cy="7" r="4" />} />
            Account &amp; profile
          </Link>
          <Link href="/events" className="dropdown-item" onClick={() => setOpen(false)}>
            <MenuIcon path="M8 2v4M16 2v4M3 10h18" extra={<rect x="3" y="4" width="18" height="18" rx="2" />} />
            My events
          </Link>

          {(corePlus || coreHeadPlus) && <div className="dropdown-sep" />}
          {/* Members: visible to everyone (member role and above) */}
          <Link href="/members" className="dropdown-item" onClick={() => setOpen(false)}>
            <MenuIcon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" extra={<><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>} />
            Members
          </Link>
          {corePlus && <div className="dropdown-section">Manage</div>}
          {corePlus && (
            <Link href="/checkin" className="dropdown-item" onClick={() => setOpen(false)}>
              <MenuIcon path="M9 11l3 3L22 4" extra={<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />} />
              Check-in scanner
            </Link>
          )}
          {coreHeadPlus && (
            <Link href="/dashboard" className="dropdown-item" onClick={() => setOpen(false)}>
              <MenuIcon path="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
              Dashboard
            </Link>
          )}
          {facultyUser && (
            <Link href="/dashboard" className="dropdown-item" onClick={() => setOpen(false)}>
              <MenuIcon path="M18 20V10M12 20V4M6 20v-6" />
              Analytics (observer)
            </Link>
          )}

          <div className="dropdown-sep" />
          <button className="dropdown-item danger" onClick={handleLogout}>
            <MenuIcon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" extra={<polyline points="16 17 21 12 16 7" />} third={<line x1="21" y1="12" x2="9" y2="12" />} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ path, extra, third }: { path: string; extra?: React.ReactNode; third?: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
      <path d={path} />
      {extra}
      {third}
    </svg>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { user, openAuth, logout } = useAuth();
  const router = useRouter();
  return (
    <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile navigation">
      {publicLinks.map((l) => (
        <Link key={l.label} href={l.href} className="header-nav-link mobile-menu-link" onClick={onClose}>
          {l.label}
        </Link>
      ))}
      <Link href="/join" className="header-nav-link mobile-menu-link" onClick={onClose}>
        JOIN US
      </Link>
      <div style={{ height: 1, background: "var(--grey-100)", margin: "12px 18px" }} />
      {!user ? (
        <button
          className="header-cta mobile-menu-cta"
          onClick={() => {
            onClose();
            openAuth("login");
          }}
        >
          SIGN IN
        </button>
      ) : (
        <>
          <Link href="/account" className="header-nav-link mobile-menu-link" onClick={onClose}>
            ACCOUNT
          </Link>
          {isCorePlus(user) && (
            <Link href="/checkin" className="header-nav-link mobile-menu-link" onClick={onClose}>
              CHECK-IN
            </Link>
          )}
          {isCoreHeadPlus(user) && (
            <Link href="/dashboard" className="header-nav-link mobile-menu-link" onClick={onClose}>
              DASHBOARD
            </Link>
          )}
          <button
            className="btn-secondary btn-sm"
            style={{ margin: "12px 18px", alignSelf: "flex-start" }}
            onClick={async () => {
              onClose();
              await logout();
              router.push("/");
            }}
          >
            Sign out
          </button>
        </>
      )}
    </nav>
  );
}
