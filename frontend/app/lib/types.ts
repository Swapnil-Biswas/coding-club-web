// Shared shapes mirroring the backend's public serializers. Field names match
// the backend JSON exactly (snake_case), so no mapping layer is needed.

export type Role = "public" | "member" | "core" | "core_head" | "admin";
export type EventVisibility = "public" | "member_only";
export type EventStatus = "draft" | "published" | "completed";
export type CertificateType =
  | "participation"
  | "winner"
  | "volunteer"
  | "speaker"
  | "organizer"
  | "special_recognition";
export type EmailStatus = "pending" | "sent" | "failed";
export type JoinRequestStatus = "new" | "contacted" | "closed";

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

// GET /users (admin panel) — slightly different shape from PublicUser.
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  email_verified: boolean;
  created_at: string;
  promoted_by: number | null;
  promoted_at: string | null;
}

export interface ClubEvent {
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

export interface Registrant {
  id: number;
  event_id: number;
  user_id: number | null;
  name: string;
  email: string;
  team_name: string;
  qr_code_token?: string;
  checked_in: number | boolean;
  checked_in_at: string | null;
  checked_in_by?: number | null;
  checked_in_by_name?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  created_at?: string;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  logo_url: string | null;
  owner_core_head_id: number;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: Role;
  club_title: string | null;
  designation: string;
  display_order: number;
  profile_photo_url: string | null;
  joined_at: string;
  // present on GET /teams/users/:id/teams
  team_id?: number;
}

export interface Photo {
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

export interface Sponsor {
  id: number;
  name: string;
  logo_url: string;
  website: string | null;
  description: string;
  sort_order: number;
}

export interface JoinRequest {
  id: number;
  name: string;
  email: string;
  message: string;
  status: JoinRequestStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EventHistory {
  event_id: number;
  gist: string;
  winners: string;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: number;
  event_id: number;
  message: string;
  posted_by: number;
  posted_at: string;
  posted_by_name?: string | null;
  posted_by_role?: Role | null;
  author_name?: string | null;
}

export interface LeaderboardEntry {
  id: number;
  event_id: number;
  team_name: string;
  score: number;
  rank: number;
  updated_by: number;
  updated_at: string;
}

export interface Certificate {
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
  // joins
  recipient_name?: string;
  recipient_email?: string;
  team_name?: string;
  event_title?: string;
  event_date?: string;
  venue?: string;
  generated_by_name?: string;
}

export interface CertificateTemplate {
  id: number;
  name: string;
  preview_image: string | null;
  template_file: string;
  created_by: number;
  created_at: string;
  creator_name?: string | null;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  message: string;
  link: string | null;
  is_read: number | boolean;
  created_at: string;
}

export interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name?: string | null;
  user_role?: Role | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  timestamp: string;
}

export interface AnalyticsOverview {
  totals: {
    total_users: number;
    total_events: number;
    total_registrants: number;
    total_checked_in: number;
    total_teams: number;
    total_certificates: number;
    total_history: number;
  };
  eventsByStatus: { status: EventStatus; count: number }[];
  usersByRole: { role: Role; count: number }[];
  recentEvents: {
    id: number;
    title: string;
    status: EventStatus;
    start_datetime: string;
  }[];
}

export interface SearchResults {
  events: Pick<
    ClubEvent,
    "id" | "title" | "status" | "start_datetime" | "venue" | "category"
  >[];
  users: Pick<PublicUser, "id" | "name" | "email" | "role" | "club_title">[];
  teams: Pick<Team, "id" | "name" | "description">[];
}
