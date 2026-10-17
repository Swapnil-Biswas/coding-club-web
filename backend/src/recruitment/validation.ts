// Recruitment validation — shared field rules for server-side enforcement.
// All validation is PURE and returns a plain object: { ok } or { error }.

import {
  ALLOWED_TEAMS,
  ALLOWED_STATUSES,
  YEAR_OPTIONS,
  HOURS_OPTIONS,
  BRANCH_OPTIONS,
  type ApplicationStatus,
  type RecruitmentTeam,
} from './types.js';

type Result = { ok: true } | { ok: false; error: string; field?: string };

function ok(): Result { return { ok: true }; }
function err(error: string, field?: string): Result { return { ok: false, error, field }; }

// Trim and coerce a raw string value.
function str(v: unknown, max = 4000): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function required(v: string, field: string, max = 4000): Result {
  if (!v || v.length > max) return err(`${field} is required and must be ≤ ${max} chars`, field);
  return ok();
}

// ─── Common fields ────────────────────────────────────────────────────────────

export interface CommonFields {
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
}

export function validateCommonFields(body: Record<string, unknown>): Result {
  const email = str(body.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err('Valid email is required', 'email');
  }

  const collegeEmail = str(body.college_email);
  if (!collegeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collegeEmail)) {
    return err('Valid college email is required', 'college_email');
  }

  const fullName = str(body.full_name, 200);
  if (!fullName) return err('Full name is required', 'full_name');

  const phone = str(body.phone, 20);
  if (!phone || !/^\+?[\d\s\-().]{7,20}$/.test(phone)) {
    return err('Valid phone number is required', 'phone');
  }

  const usn = str(body.usn, 30);
  if (!usn) return err('USN is required', 'usn');

  const year = str(body.year_of_study);
  if (!(YEAR_OPTIONS as readonly string[]).includes(year)) {
    return err('Invalid year of study', 'year_of_study');
  }

  const branch = str(body.branch, 200);
  if (!(BRANCH_OPTIONS as readonly string[]).includes(branch)) {
    return err('Invalid branch/department', 'branch');
  }

  const team = str(body.selected_team) as RecruitmentTeam;
  if (!ALLOWED_TEAMS.includes(team)) {
    return err('Invalid team selection', 'selected_team');
  }

  const clubsOrgs = str(body.clubs_orgs, 2000);
  if (!clubsOrgs) return err('Please fill in clubs/orgs field (use N/A if none)', 'clubs_orgs');

  const whyJoin = str(body.why_join, 3000);
  if (!whyJoin) return err('Please explain why you want to join', 'why_join');

  const hours = str(body.weekly_hours);
  if (!(HOURS_OPTIONS as readonly string[]).includes(hours)) {
    return err('Invalid weekly hours selection', 'weekly_hours');
  }

  return ok();
}

export function extractCommonFields(body: Record<string, unknown>): CommonFields {
  return {
    email: str(body.email),
    college_email: str(body.college_email).toLowerCase(),
    full_name: str(body.full_name, 200),
    phone: str(body.phone, 20),
    usn: str(body.usn, 30),
    year_of_study: str(body.year_of_study),
    branch: str(body.branch, 200),
    selected_team: str(body.selected_team) as RecruitmentTeam,
    clubs_orgs: str(body.clubs_orgs, 2000),
    why_join: str(body.why_join, 3000),
    weekly_hours: str(body.weekly_hours),
  };
}

// ─── Team-specific validation ─────────────────────────────────────────────────

const DESIGN_TOOLS = ['Canva','Figma','Adobe Photoshop','Adobe Illustrator',"Haven't used any yet",'Other'];
const DESIGN_PAST_WORK = [
  'Event posters','Social media posts','Logos or brand identities',
  'Presentations','Merchandise or apparel','Video edits or motion graphics',
  'Personal design projects','None yet, but I\'m interested in learning',
];
const MARKETING_AREAS = [
  'Social media management','Content writing and captions',
  'Branding and promotions','Community growth','Other',
];
const TECH_DOMAINS = [
  'Data Structures & Algorithms (DSA)','Web Development','App Development',
  'AI / Machine Learning','Blockchain / Web3','Cybersecurity',
  'Cloud Computing / DevOps','UI/UX and Frontend Development',
  'Beginner – eager to learn','Other',
];

function validateStringArray(value: unknown, allowed: string[], field: string, minLength = 1): Result {
  if (!Array.isArray(value) || value.length < minLength) {
    return err(`${field} must have at least ${minLength} selection`, field);
  }
  if (!value.every((v) => typeof v === 'string' && allowed.includes(v))) {
    return err(`Invalid selection in ${field}`, field);
  }
  return ok();
}

function validateUrl(value: unknown, field: string, required = false): Result {
  const u = str(value as string, 500);
  if (!u) {
    if (required) return err(`${field} is required`, field);
    return ok();
  }
  try {
    const parsed = new URL(u);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return err(`${field} must be an http or https URL`, field);
    }
  } catch {
    return err(`${field} must be a valid URL`, field);
  }
  return ok();
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// Sanitize a free-text value to prevent formula injection in Sheets exports.
export function sanitizeForSheets(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

export function validateTeamResponses(
  team: RecruitmentTeam,
  responses: Record<string, unknown>,
): Result {
  switch (team) {
    case 'design': return validateDesignResponses(responses);
    case 'marketing': return validateMarketingResponses(responses);
    case 'events_ops': return validateEventsOpsResponses(responses);
    case 'technical': return validateTechnicalResponses(responses);
    case 'outreach_sponsorship': return validateOutreachResponses(responses);
    default: return err('Unknown team');
  }
}

function validateDesignResponses(r: Record<string, unknown>): Result {
  const worked = str(r.design_worked_before);
  if (!['Yes','No'].includes(worked)) return err('Please answer if you worked in design before', 'design_worked_before');

  const toolsResult = validateStringArray(r.design_tools, DESIGN_TOOLS, 'design_tools', 1);
  if (!toolsResult.ok) return toolsResult;

  const pastWorkResult = validateStringArray(r.design_past_work, DESIGN_PAST_WORK, 'design_past_work', 1);
  if (!pastWorkResult.ok) return pastWorkResult;

  // File handled separately via multer
  const admiredUrl = validateUrl(r.design_admired_url, 'design_admired_url', false);
  if (!admiredUrl.ok) return admiredUrl;

  const admiredExplain = str(r.design_admired_explain, 2000);
  if (!admiredExplain) return err('Explain what makes the admired design effective', 'design_admired_explain');

  const brandName = str(r.design_brand_name, 500);
  if (!brandName) return err('Name a brand/designer you like', 'design_brand_name');

  const brandWhy = str(r.design_brand_why, 2000);
  if (!brandWhy) return err('Explain what you like about their work', 'design_brand_why');

  const inspiration = str(r.design_inspiration, 2000);
  if (!inspiration) return err('Where do you find inspiration?', 'design_inspiration');

  const aiTools = str(r.design_ai_tools, 2000);
  if (!aiTools) return err('Describe how you use AI tools in your design process', 'design_ai_tools');

  const consistency = str(r.design_consistency, 2000);
  if (!consistency) return err('Explain how you maintain visual identity consistency', 'design_consistency');

  const prioritise = str(r.design_prioritise, 2000);
  if (!prioritise) return err('How would you prioritise the poster/Instagram/ID card tasks?', 'design_prioritise');

  const interest = str(r.design_interest, 3000);
  if (!interest) return err('Why are you interested in the Design Team?', 'design_interest');

  return ok();
}

function validateMarketingResponses(r: Record<string, unknown>): Result {
  const areasResult = validateStringArray(r.marketing_areas, MARKETING_AREAS, 'marketing_areas', 1);
  if (!areasResult.ok) return areasResult;

  const platforms = str(r.marketing_platforms, 1000);
  if (!platforms) return err('Which platforms do you use for content?', 'marketing_platforms');

  const experience = str(r.marketing_experience, 2000);
  if (!experience) return err('Describe your marketing/content creation experience', 'marketing_experience');
  if (countWords(experience) > 60) return err('Experience description must be ≤ 50 words', 'marketing_experience');

  // Portfolio links: optional
  const portfolioLinks = str(r.marketing_portfolio_links, 2000);
  // no strict URL validation; could be multiple links separated by newlines

  const whyMarketing = str(r.marketing_why, 2000);
  if (!whyMarketing) return err('Why do you want to join the Marketing team?', 'marketing_why');

  const hackathonPromo = str(r.marketing_hackathon_promo, 2000);
  if (!hackathonPromo) return err('How would you promote the hackathon?', 'marketing_hackathon_promo');

  const improve = str(r.marketing_improve, 2000);
  if (!improve) return err('What would you change about how the club promotes itself?', 'marketing_improve');

  void portfolioLinks;
  return ok();
}

function validateEventsOpsResponses(r: Record<string, unknown>): Result {
  const fields: Array<{ key: string; label: string }> = [
    { key: 'events_wifi_crash', label: 'Wi-Fi crash scenario answer' },
    { key: 'events_engagement', label: 'Engagement initiative proposal' },
    { key: 'events_priorities', label: 'Conflicting priorities experience' },
    { key: 'events_teammate', label: 'Unresponsive teammate scenario answer' },
    { key: 'events_highstakes', label: 'High-stakes deadline response' },
    { key: 'events_why', label: 'Why Events & Ops (with event idea)' },
  ];
  for (const f of fields) {
    const v = str(r[f.key], 3000);
    if (!v) return err(`${f.label} is required`, f.key);
  }
  return ok();
}

function validateTechnicalResponses(r: Record<string, unknown>): Result {
  const domainsResult = validateStringArray(r.tech_domains, TECH_DOMAINS, 'tech_domains', 1);
  if (!domainsResult.ok) return domainsResult;

  // GitHub — required; N/A allowed
  const github = str(r.tech_github, 500);
  if (!github) return err('GitHub URL or N/A is required', 'tech_github');
  if (github !== 'N/A') {
    const urlResult = validateUrl(github, 'tech_github', false);
    if (!urlResult.ok) return urlResult;
  }

  // Portfolio — optional
  const portfolio = str(r.tech_portfolio, 500);
  if (portfolio && portfolio !== 'N/A') {
    const pResult = validateUrl(portfolio, 'tech_portfolio', false);
    if (!pResult.ok) return pResult;
  }

  // DSA profiles — conditional
  const domains = Array.isArray(r.tech_domains) ? r.tech_domains : [];
  const wantsDsa = domains.includes('Data Structures & Algorithms (DSA)');
  const dsaProfiles = str(r.tech_dsa_profiles, 1000);
  if (wantsDsa && !dsaProfiles) {
    return err('DSA profiles are required when DSA is selected', 'tech_dsa_profiles');
  }

  const projects = str(r.tech_projects, 3000);
  if (!projects) return err('Tell us about your technical projects', 'tech_projects');

  const challenge = str(r.tech_challenge, 3000);
  if (!challenge) return err('Describe a technical challenge you faced', 'tech_challenge');

  const why = str(r.tech_why, 3000);
  if (!why) return err('Why do you want to join the Technical Team?', 'tech_why');

  return ok();
}

function validateOutreachResponses(r: Record<string, unknown>): Result {
  const fields: Array<{ key: string; label: string }> = [
    { key: 'outreach_experience', label: 'Outreach/sponsorship experience (or N/A)' },
    { key: 'outreach_sponsor_approach', label: 'Sponsor identification and approach' },
    { key: 'outreach_no_response', label: 'No sponsor response follow-up plan' },
    { key: 'outreach_task', label: 'Sponsor-securing task plan' },
    { key: 'outreach_why', label: 'Why Outreach & Sponsorship Team' },
  ];
  for (const f of fields) {
    const v = str(r[f.key], 3000);
    if (!v) return err(`${f.label} is required`, f.key);
  }
  return ok();
}

export function validateStatusTransition(
  currentStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
): Result {
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return err(`Invalid status: ${newStatus}`);
  }
  // Withdrawn can be set at any time (applicant withdrawal)
  // but only admin can re-open a withdrawn app
  if (currentStatus === 'withdrawn' && newStatus !== 'withdrawn') {
    return err('Cannot change status of a withdrawn application without admin override');
  }
  return ok();
}
