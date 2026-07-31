import type { Role } from "./types";

// Client-side mirrors of the backend's permission helpers. These drive UI
// decisions ONLY (whether to show a button or a nav link). The backend
// re-enforces every rule server-side; a stale or forged UI check just yields
// a 403, never a privilege escalation.

export const ROLE_RANK: Record<Role, number> = {
  public: 0,
  member: 1,
  core: 2,
  core_head: 3,
  admin: 4,
};

export function roleAtLeast(
  role: Role | null | undefined,
  min: Role,
): boolean {
  return (role ? ROLE_RANK[role] : 0) >= ROLE_RANK[min];
}

export function isPresident(user: {
  role: Role;
  club_title: string | null;
} | null): boolean {
  return !!user && user.role === "core_head" && user.club_title === "President";
}

export function isAdmin(user: { role: Role } | null): boolean {
  return !!user && user.role === "admin";
}

// Admin and President both act as "super core heads" for management UIs.
export function isSuperCoreHead(user: {
  role: Role;
  club_title: string | null;
} | null): boolean {
  return !!user && (user.role === "admin" || isPresident(user));
}

// core+ — can scan QR, manual check-in, view the members panel.
export function isCorePlus(user: { role: Role } | null): boolean {
  return !!user && roleAtLeast(user.role, "core");
}

// core_head+ — can publish, import CSV, manage teams/events/sponsors.
export function isCoreHeadPlus(user: { role: Role } | null): boolean {
  return !!user && roleAtLeast(user.role, "core_head");
}

// Human-readable label for a role, for badges.
export function roleLabel(role: Role): string {
  switch (role) {
    case "core_head":
      return "Core Head";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

// Display title: prefer club_title (President, Tech Lead...) over the raw role.
export function displayTitle(user: {
  role: Role;
  club_title: string | null;
}): string {
  return user.club_title || roleLabel(user.role);
}
