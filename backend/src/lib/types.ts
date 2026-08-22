// Shared backend domain types.
//
// These interfaces mirror the runtime database rows and JSON serializers that
// already exist in the application. They intentionally do not introduce new
// fields or change snake_case API contracts.

import type { Request } from 'express';

export type Role = 'public' | 'member' | 'core' | 'core_head' | 'admin' | 'faculty';
export type EventVisibility = 'public' | 'member_only';
export type EventStatus = 'draft' | 'published' | 'completed';
export type CertificateType =
  | 'participation'
  | 'winner'
  | 'volunteer'
  | 'speaker'
  | 'organizer'
  | 'special_recognition';
export type EmailStatus = 'pending' | 'sent' | 'failed';
export type JoinRequestStatus = 'new' | 'contacted' | 'closed';
export type ProjectCategory = 'web' | 'ai' | 'mobile' | 'open-source' | 'other';
export type ProjectStatus = 'shipped' | 'wip' | 'concept';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  email_verified: number | boolean;
  created_at: string;
  promoted_by: number | null;
  promoted_at: string | null;
  profile_photo_path: string | null;
  club_title: string | null;
}

export type SessionUser = UserRow & { _sessionId?: string };

export type ActorLike = Pick<UserRow, 'id' | 'role' | 'name' | 'club_title'> | {
  id: number | null;
  role: Role;
  name: string;
  club_title?: string | null;
};

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  email_verified: boolean;
  profile_photo_url: string | null;
  club_title: string | null;
  created_at: string;
}

export type PublicProfile = Pick<PublicUser,
  | 'id'
  | 'name'
  | 'role'
  | 'profile_photo_url'
  | 'club_title'
>;

export interface DirectoryUser {
  id: number;
  name: string;
  role: Role;
  club_title: string | null;
  created_at: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  email_verified: boolean;
  club_title: string | null;
  created_at: string;
  promoted_by: number | null;
  promoted_at: string | null;
  is_seeded_admin: boolean;  // protected root admin — cannot be modified by other admins
}

export interface SessionRow {
  id: string;
  user_id: number;
  created_at: string;
  expires_at: string;
  expires_at_epoch: number;
}

export interface EmailVerificationRow {
  id: number;
  user_id: number;
  code_hash: string;
  expires_at: string;
  expires_at_epoch: number;
  failed_attempts: number;
  consumed_at: string | null;
}

export interface EventRow {
  id: number;
  title: string;
  description: string;
  banner_image_path: string | null;
  start_datetime: string;
  end_datetime: string;
  venue: string;
  category: string;
  visibility: EventVisibility;
  status: EventStatus;
  unstop_link: string | null;
  organizer_id: number;
  created_at: string;
  updated_at: string;
}

export interface PublicEvent {
  id: number;
  title: string;
  description: string;
  banner_image_url: string | null;
  start_datetime: string;
  end_datetime: string;
  venue: string;
  category: string;
  visibility: EventVisibility;
  status: EventStatus;
  unstop_link: string | null;
  organizer_id: number;
  created_at: string;
  updated_at: string;
}

export interface RegistrantRow {
  id: number;
  event_id: number;
  user_id: number | null;
  name: string;
  email: string;
  team_name: string;
  qr_code_token: string;
  checked_in: number | boolean;
  checked_in_at: string | null;
  checked_in_by: number | null;
  created_at: string;
  checked_in_by_name?: string | null;
}

export type AttendanceRegistrant = Pick<RegistrantRow,
  | 'id'
  | 'event_id'
  | 'user_id'
  | 'name'
  | 'email'
  | 'team_name'
  | 'checked_in'
  | 'checked_in_at'
  | 'created_at'
  | 'checked_in_by_name'
>;

export interface TeamRow {
  id: number;
  name: string;
  description: string;
  logo_url: string | null;
  owner_core_head_id: number;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
}

export interface PublicTeam {
  id: number;
  name: string;
  description: string;
  logo_url: string | null;
  owner_core_head_id: number;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: number;
  team_id: number;
  user_id: number;
  designation: string;
  display_order: number;
  joined_at: string;
  name: string;
  role: Role;
  club_title: string | null;
  profile_photo_path: string | null;
}

export interface PublicTeamMember {
  id: number;
  user_id: number;
  name: string;
  role: Role;
  club_title: string | null;
  designation: string;
  display_order: number;
  profile_photo_url: string | null;
  joined_at: string;
  team_id?: number;
}

export interface UserTeamRow {
  id: number;
  name: string;
  description: string;
  logo_url: string | null;
  designation: string;
  display_order: number;
  joined_at: string;
}

export interface PhotoRow {
  id: number;
  uploaded_by: number;
  event_id: number | null;
  image_url: string;
  caption: string | null;
  is_featured: number | boolean;
  sort_order: number;
  created_at: string;
  uploader_name?: string | null;
}

export interface PublicPhoto {
  id: number;
  uploaded_by: number;
  uploader_name: string | null;
  event_id: number | null;
  image_url: string;
  caption: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

export interface EventHistoryRow {
  event_id: number;
  gist: string;
  winners: string;
  created_at: string;
  updated_at: string;
}

export type PublicEventHistory = EventHistoryRow;

export interface SponsorRow {
  id: number;
  name: string;
  logo_url: string;
  website: string | null;
  description: string;
  sort_order: number;
}

export type PublicSponsor = SponsorRow;

export interface JoinRequestRow {
  id: number;
  name: string;
  email: string;
  message: string;
  status: JoinRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicJoinRequest {
  id: number;
  name: string;
  email: string;
  message: string;
  status: JoinRequestStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AboutPageRow {
  id: number;
  content: string;
  updated_at: string;
  updated_by: number | null;
}

export interface AboutPageContent {
  content: string;
  updated_at: string | null;
}

export interface CertificateTemplateRow {
  id: number;
  name: string;
  preview_image: string | null;
  template_file: string;
  created_by: number;
  created_at: string;
  creator_name?: string | null;
}

export interface CertificateRow {
  id: number;
  registrant_id: number;
  event_id: number;
  verification_id: string;
  certificate_type: CertificateType;
  template_id: number | null;
  generated_by: number;
  generated_at: string;
  pdf_url: string | null;
  emailed_at: string | null;
  email_status: EmailStatus;
  recipient_name?: string;
  recipient_email?: string;
  team_name?: string;
  event_title?: string;
  event_date?: string;
  venue?: string;
  generated_by_name?: string;
}

export interface LeaderboardRow {
  id: number;
  event_id: number;
  team_name: string;
  score: number;
  rank: number;
  updated_by: number;
  updated_at: string;
}

export type PublicLeaderboardEntry = LeaderboardRow;

export interface AnnouncementRow {
  id: number;
  event_id: number;
  message: string;
  posted_by: number;
  posted_at: string;
  posted_by_name?: string | null;
  posted_by_role?: Role | null;
}

export interface ActivityLogRow {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  timestamp: string;
  user_name?: string | null;
  user_role?: Role | null;
}

export interface NotificationRow {
  id: number;
  user_id: number;
  type: string;
  message: string;
  link: string | null;
  is_read: number | boolean;
  created_at: string;
}

export interface ProjectRow {
  id: number;
  title: string;
  description: string;
  tags: string;
  category: ProjectCategory;
  status: ProjectStatus;
  author_name: string;
  year: string;
  github_url: string | null;
  live_url: string | null;
  featured: number | boolean;
  sort_order: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  creator_name?: string | null;
}

export interface PublicProject {
  id: number;
  title: string;
  description: string;
  tags: string[];
  category: ProjectCategory;
  status: ProjectStatus;
  author_name: string;
  year: string;
  github_url: string | null;
  live_url: string | null;
  featured: boolean;
  sort_order: number;
  created_by: number;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentorRow {
  id: number;
  name: string;
  photo_url: string | null;
  bio: string;
  current_role: string | null;
  organization: string;
  linkedin_url: string | null;
  github_url: string | null;
  whatsapp_number: string | null;
  is_active: number | boolean;
  sort_order: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface BasicMentor {
  id: number;
  name: string;
  photo_url: string | null;
  bio: string;
  current_role: string | null;
  organization: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FullMentor extends BasicMentor {
  linkedin_url: string | null;
  github_url: string | null;
  whatsapp_number: string | null;
}

export interface AnalyticsTotals {
  total_users: number;
  total_events: number;
  total_registrants: number;
  total_checked_in: number;
  total_teams: number;
  total_certificates: number;
  total_history: number;
}

export interface AnalyticsOverview {
  totals: AnalyticsTotals;
  eventsByStatus: Array<{ status: EventStatus; count: number }>;
  usersByRole: Array<{ role: Role; count: number }>;
  recentEvents: Array<Pick<EventRow, 'id' | 'title' | 'status' | 'start_datetime'>>;
}

export interface EventAnalyticsStats {
  total_registrants: number;
  checked_in: number;
  member_registrants: number;
  certificates_issued: number;
  announcements_posted: number;
  leaderboard_entries: number;
}

export interface SearchResults {
  events: Array<Pick<EventRow, 'id' | 'title' | 'status' | 'start_datetime' | 'venue' | 'category'>>;
  users: Array<Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'club_title'>>;
  teams: Array<Pick<TeamRow, 'id' | 'name' | 'description'>>;
}

export interface HttpErrorDetails {
  [key: string]: unknown;
}

export interface AuthRequest extends Request {
  user: SessionUser | null;
}

export interface CsvRow {
  [header: string]: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
}

export interface ImportRegistrantsResult {
  created: number;
  skipped: number;
  errors: number;
  total: number;
}

export interface CheckinResult {
  success?: boolean;
  alreadyCheckedIn?: boolean;
  message: string;
  registrantId: number;
}

export interface ExportAttendanceResult {
  csv: string;
  filename: string;
}

export interface MyQrToken {
  qr_code_token: string;
  checked_in: number | boolean;
}

export type JsonRecord = Record<string, unknown>;
