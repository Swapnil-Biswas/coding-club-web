// Small presentation helpers shared across pages.

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime())) return start;
  if (Number.isNaN(e.getTime())) return formatDate(start);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) return formatDate(start);
  const sameMonth =
    s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${e.getDate()}`;
  }
  return `${formatDate(start)} — ${formatDate(end)}`;
}

/** Convert an ISO string to the value an <input type="datetime-local"> wants. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Display a club_title nicely. The only title with platform meaning is
 * "President"; the rest are free-text designations shown verbatim.
 */
export function prettyTitle(title: string | null | undefined): string {
  return title?.trim() || "";
}

export const CERTIFICATE_TYPE_LABELS: Record<string, string> = {
  participation: "Participation",
  winner: "Winner",
  volunteer: "Volunteer",
  speaker: "Speaker",
  organizer: "Organizer",
  special_recognition: "Special Recognition",
};

export function certTypeLabel(type: string): string {
  return CERTIFICATE_TYPE_LABELS[type] || type;
}
