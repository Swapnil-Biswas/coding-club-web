// Shared recruitment type definitions for backend.

export type RecruitmentTeam =
  | 'design'
  | 'marketing'
  | 'events_ops'
  | 'technical'
  | 'outreach_sponsorship';

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'selected'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn';

export type SyncState = 'pending' | 'synced' | 'failed';
export type ScanStatus = 'pending' | 'clean' | 'quarantined' | 'skipped';

export const ALLOWED_TEAMS: RecruitmentTeam[] = [
  'design', 'marketing', 'events_ops', 'technical', 'outreach_sponsorship',
];

export const ALLOWED_STATUSES: ApplicationStatus[] = [
  'submitted','under_review','shortlisted','interview_scheduled',
  'selected','rejected','waitlisted','withdrawn',
];

export const YEAR_OPTIONS = ['1st year','2nd year','3rd year','4th year'] as const;
export const HOURS_OPTIONS = ['1–2 hrs','3–5 hrs','6–8 hrs','9+ hrs'] as const;

export const BRANCH_OPTIONS = [
  'Artificial Intelligence and Machine Learning',
  'Computer Science and Engineering',
  'Computer Science and Business Systems',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
] as const;

// Allowed MIME types for design uploads (explicit allowlist)
export const ALLOWED_DESIGN_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',       // handled safely — served as download, not rendered
  'application/pdf',
]);

export const ALLOWED_DESIGN_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf',
]);

export const MAX_DESIGN_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

// ─── Row types ───────────────────────────────────────────────────────────────

export interface RecruitmentCycleRow {
  id: string;
  title: string;
  is_open: number | boolean;
  opened_at: string | null;
  closed_at: string | null;
  opened_by: number | null;
  closed_by: number | null;
  announcement_version: number;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  cycle_id: string;
  idempotency_key: string | null;
  status: ApplicationStatus;
  email: string;
  college_email: string;
  full_name: string;
  phone: string;
  usn: string;
  year_of_study: string;
  branch: string;
  selected_team: RecruitmentTeam;
  clubs_orgs: string;
  why_join: string;
  weekly_hours: string;
  team_responses: string; // JSON string
  form_version: string;
  submitted_at: string;
  updated_at: string;
}

export interface ApplicationFileRow {
  id: string;
  application_id: string;
  field_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  checksum_sha256: string;
  scan_status: ScanStatus;
  uploaded_at: string;
}

export interface SheetsSyncRow {
  id: number;
  application_id: string;
  idempotency_key: string;
  state: SyncState;
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string;
  last_error: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryRow {
  id: number;
  application_id: string;
  old_status: ApplicationStatus;
  new_status: ApplicationStatus;
  actor_id: number | null;
  reason: string;
  changed_at: string;
}

// ─── Public-facing types (returned to frontend) ───────────────────────────────

export interface PublicRecruitmentState {
  is_open: boolean;
  cycle_id: string;
  title: string;
  announcement_version: number;
}

export interface PublicApplication {
  id: string;
  cycle_id: string;
  status: ApplicationStatus;
  email: string;
  college_email: string;
  full_name: string;
  phone: string;
  usn: string;
  year_of_study: string;
  branch: string;
  selected_team: RecruitmentTeam;
  clubs_orgs: string;
  why_join: string;
  weekly_hours: string;
  team_responses: Record<string, unknown>;
  form_version: string;
  submitted_at: string;
  updated_at: string;
  files?: PublicApplicationFile[];
  status_history?: PublicStatusHistory[];
}

export interface PublicApplicationFile {
  id: string;
  field_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  scan_status: ScanStatus;
  uploaded_at: string;
}

export interface PublicStatusHistory {
  id: number;
  old_status: ApplicationStatus;
  new_status: ApplicationStatus;
  actor_id: number | null;
  reason: string;
  changed_at: string;
}

export interface AdminApplicationSummary {
  id: string;
  cycle_id: string;
  status: ApplicationStatus;
  full_name: string;
  email: string;
  college_email: string;
  usn: string;
  year_of_study: string;
  branch: string;
  selected_team: RecruitmentTeam;
  submitted_at: string;
  sync_state: SyncState | null;
}

export interface SyncHealthSummary {
  total_applications: number;
  synced: number;
  pending: number;
  failed: number;
  last_synced_at: string | null;
}
