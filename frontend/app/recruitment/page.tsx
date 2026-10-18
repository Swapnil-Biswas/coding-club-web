"use client";

import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { useRecruitment } from "@/app/lib/recruitment";
import { API_BASE } from "@/app/lib/api";
import {
  TeamIcon,
  ShieldIcon,
  TypeIcon,
  LinkIcon,
  LockIcon,
  CheckCircleIcon,
} from "@/app/components/app/RecruitmentIcons";

// ─── Types ────────────────────────────────────────────────────────────────────

type Team = "design" | "marketing" | "events_ops" | "technical" | "outreach_sponsorship";

const TEAMS: Array<{ id: Team; label: string; desc: string }> = [
  {
    id: "design",
    label: "Design Team",
    desc: "Create engaging visuals and build the club's visual identity.",
  },
  {
    id: "marketing",
    label: "Marketing Team",
    desc: "Promote initiatives, manage outreach, and grow the community.",
  },
  {
    id: "events_ops",
    label: "Events & Operations",
    desc: "Plan, coordinate, and execute workshops, hackathons, and club events.",
  },
  {
    id: "technical",
    label: "Technical Team",
    desc: "Build projects, solve problems, and develop innovative technical solutions.",
  },
  {
    id: "outreach_sponsorship",
    label: "Outreach & Sponsorship",
    desc: "Build industry connections, secure sponsorships, and establish strategic partnerships.",
  },
];

const YEAR_OPTIONS = ["1st year", "2nd year", "3rd year", "4th year"];
const HOURS_OPTIONS = ["1–2 hrs", "3–5 hrs", "6–8 hrs", "9+ hrs"];
const BRANCH_OPTIONS = [
  "Artificial Intelligence and Machine Learning",
  "Computer Science and Engineering",
  "Computer Science and Business Systems",
  "Electronics and Communication Engineering",
  "Electrical and Electronics Engineering",
  "Mechanical Engineering",
];

const DESIGN_TOOLS = ["Canva", "Figma", "Adobe Photoshop", "Adobe Illustrator", "Haven't used any yet", "Other"];
const DESIGN_PAST_WORK = [
  "Event posters", "Social media posts", "Logos or brand identities", "Presentations",
  "Merchandise or apparel", "Video edits or motion graphics", "Personal design projects",
  "None yet, but I'm interested in learning",
];
const MARKETING_AREAS = [
  "Social media management", "Content writing and captions",
  "Branding and promotions", "Community growth", "Other",
];
const TECH_DOMAINS = [
  "Data Structures & Algorithms (DSA)", "Web Development", "App Development",
  "AI / Machine Learning", "Blockchain / Web3", "Cybersecurity",
  "Cloud Computing / DevOps", "UI/UX and Frontend Development",
  "Beginner – eager to learn", "Other",
];

// ─── Common form state ────────────────────────────────────────────────────────

interface CommonData {
  email: string;
  full_name: string;
  college_email: string;
  phone: string;
  usn: string;
  year_of_study: string;
  branch: string;
  selected_team: Team | "";
  clubs_orgs: string;
  why_join: string;
  weekly_hours: string;
}

// ─── Team-specific response maps ──────────────────────────────────────────────

interface DesignData {
  design_worked_before: string;
  design_tools: string[];
  design_tools_other: string;
  design_past_work: string[];
  design_admired_url: string;
  design_admired_explain: string;
  design_brand_name: string;
  design_brand_why: string;
  design_inspiration: string;
  design_ai_tools: string;
  design_consistency: string;
  design_prioritise: string;
  design_interest: string;
  design_file: File | null;
}

interface MarketingData {
  marketing_areas: string[];
  marketing_areas_other: string;
  marketing_platforms: string;
  marketing_experience: string;
  marketing_portfolio_links: string;
  marketing_why: string;
  marketing_hackathon_promo: string;
  marketing_improve: string;
}

interface EventsData {
  events_wifi_crash: string;
  events_engagement: string;
  events_priorities: string;
  events_teammate: string;
  events_highstakes: string;
  events_why: string;
}

interface TechnicalData {
  tech_domains: string[];
  tech_domains_other: string;
  tech_github: string;
  tech_portfolio: string;
  tech_dsa_profiles: string;
  tech_projects: string;
  tech_challenge: string;
  tech_why: string;
}

interface OutreachData {
  outreach_experience: string;
  outreach_sponsor_approach: string;
  outreach_no_response: string;
  outreach_task: string;
  outreach_why: string;
}

// ─── Reusable field components ────────────────────────────────────────────────

function Field({ label, required, children, hint }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rec-field">
      <label className="rec-label">
        {label}
        {required && <span className="rec-required" aria-hidden="true"> *</span>}
      </label>
      {hint && <p className="rec-hint">{hint}</p>}
      {children}
    </div>
  );
}

// ─── Anti-AI Paste Prevention Context ─────────────────────────────────────────

const AntiPasteContext = createContext<{
  onPasteBlocked: (fieldName?: string) => void;
}>({
  onPasteBlocked: () => {},
});

function useAntiPaste() {
  return useContext(AntiPasteContext);
}

function TextInput({ id, value, onChange, placeholder, type = "text", maxLength, required, allowPaste = true }: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; maxLength?: number; required?: boolean; allowPaste?: boolean;
}) {
  const { onPasteBlocked } = useAntiPaste();
  const [shaking, setShaking] = useState(false);

  const handleBlocked = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
    onPasteBlocked(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!allowPaste) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        handleBlocked(e);
      } else if (e.shiftKey && e.key === "Insert") {
        handleBlocked(e);
      }
    }
  };

  return (
    <div className={shaking ? "rec-shake-input" : ""}>
      <input
        id={id}
        type={type}
        className="rec-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={allowPaste ? undefined : handleBlocked}
        onDrop={allowPaste ? undefined : handleBlocked}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        aria-required={required}
      />
    </div>
  );
}

function Textarea({ id, value, onChange, placeholder, maxLength, rows = 5, required, allowPaste = false }: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number; rows?: number; required?: boolean; allowPaste?: boolean;
}) {
  const { onPasteBlocked } = useAntiPaste();
  const [shaking, setShaking] = useState(false);
  const words = value.trim().split(/\s+/).filter(Boolean).length;

  const handleBlocked = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
    onPasteBlocked(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!allowPaste) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        handleBlocked(e);
      } else if (e.shiftKey && e.key === "Insert") {
        handleBlocked(e);
      }
    }
  };

  return (
    <div className={`rec-textarea-wrap ${shaking ? "rec-shake-input" : ""}`}>
      <textarea
        id={id}
        className="rec-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={allowPaste ? undefined : handleBlocked}
        onDrop={allowPaste ? undefined : handleBlocked}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        required={required}
        aria-required={required}
      />
      <div className="rec-textarea-footer">
        {!allowPaste ? (
          <span className="rec-nopaste-tag" title="Copy-pasting is disabled to ensure authentic, non-AI answers">
            <TypeIcon size={12} /> Type directly (pasting disabled)
          </span>
        ) : (
          <span className="rec-paste-allowed-tag" title="Links can be pasted here">
            <LinkIcon size={12} /> Links can be pasted
          </span>
        )}
        <div className="rec-textarea-meta">
          {maxLength && (
            <span className="rec-char-count">{value.length} / {maxLength} chars</span>
          )}
          {id.includes("experience") && (
            <span className={`rec-char-count ${words > 55 ? "rec-char-count--warn" : ""}`}>
              {words} words {words > 50 ? "(keep under 50)" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Select({ id, value, onChange, options, required }: {
  id: string; value: string; onChange: (v: string) => void;
  options: string[]; required?: boolean;
}) {
  return (
    <select
      id={id}
      className="rec-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      aria-required={required}
    >
      <option value="">Select…</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function CheckboxGroup({ id, options, selected, onChange }: {
  id: string; options: string[]; selected: string[];
  onChange: (selected: string[]) => void;
}) {
  function toggle(o: string) {
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  }
  return (
    <div className="rec-checkbox-group" role="group" aria-labelledby={`${id}-label`}>
      {options.map((o) => (
        <label key={o} className="rec-checkbox-item">
          <input
            type="checkbox"
            checked={selected.includes(o)}
            onChange={() => toggle(o)}
            aria-checked={selected.includes(o)}
          />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Step 1: Common info ──────────────────────────────────────────────────────

function Step1({ data, onChange }: { data: CommonData; onChange: (d: Partial<CommonData>) => void }) {
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Personal Information</h2>
        <p className="rec-step-desc">
          Fill in your basic details. Both your personal and college email are required
          so we can contact you about your application.
        </p>
      </div>

      <div className="rec-grid-2">
        <Field label="Email (Personal / Contact)" required>
          <TextInput id="email" type="email" value={data.email}
            onChange={(v) => onChange({ email: v })} placeholder="you@gmail.com" required />
        </Field>
        <Field label="Full Name" required>
          <TextInput id="full_name" value={data.full_name}
            onChange={(v) => onChange({ full_name: v })} placeholder="Your full name" required maxLength={200} />
        </Field>
        <Field label="College Email Id" required
          hint="Your @bmsit.in institutional email address.">
          <TextInput id="college_email" type="email" value={data.college_email}
            onChange={(v) => onChange({ college_email: v })} placeholder="name@bmsit.in" required />
        </Field>
        <Field label="Phone Number" required>
          <TextInput id="phone" type="tel" value={data.phone}
            onChange={(v) => onChange({ phone: v })} placeholder="+91 9XXXXXXXXX" required maxLength={20} />
        </Field>
        <Field label="USN" required>
          <TextInput id="usn" value={data.usn}
            onChange={(v) => onChange({ usn: v })} placeholder="1BM22CS001" required maxLength={30} />
        </Field>
        <Field label="Year of Study" required>
          <Select id="year_of_study" value={data.year_of_study}
            onChange={(v) => onChange({ year_of_study: v })} options={YEAR_OPTIONS} required />
        </Field>
      </div>

      <Field label="Branch / Department" required>
        <Select id="branch" value={data.branch}
          onChange={(v) => onChange({ branch: v })} options={BRANCH_OPTIONS} required />
      </Field>
    </div>
  );
}

// ─── Step 2: Role selection + shared questions ────────────────────────────────

function Step2({ data, onChange }: { data: CommonData; onChange: (d: Partial<CommonData>) => void }) {
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Role Selection</h2>
        <p className="rec-step-desc">
          Choose the team you want to apply for. Read each description carefully —
          you can apply for exactly one team per cycle.
        </p>
      </div>

      <Field label="Which role are you applying for?" required>
        <div className="rec-team-grid">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rec-team-card ${data.selected_team === t.id ? "rec-team-card--active" : ""}`}
              onClick={() => onChange({ selected_team: t.id })}
              aria-pressed={data.selected_team === t.id}
              id={`team-${t.id}`}
            >
              <div className="rec-team-icon-box" aria-hidden="true">
                <TeamIcon team={t.id} size={22} />
              </div>
              <strong className="rec-team-label">{t.label}</strong>
              <p className="rec-team-desc">{t.desc}</p>
            </button>
          ))}
        </div>
      </Field>

      <div className="rec-divider" />

      <Field label="Clubs or student organisations you're currently a part of" required
        hint="Include their names and your role in each. Write N/A if none.">
        <Textarea id="clubs_orgs" value={data.clubs_orgs}
          onChange={(v) => onChange({ clubs_orgs: v })} rows={3}
          placeholder="E.g. NSS – Volunteer, IEEE – General Member" maxLength={2000} required />
      </Field>

      <Field label="Why do you want to join the Coding Club?" required
        hint="What makes you interested in being a part of our team?">
        <Textarea id="why_join" value={data.why_join}
          onChange={(v) => onChange({ why_join: v })} rows={5}
          placeholder="Share your motivation and what draws you to the Coding Club…" maxLength={3000} required />
      </Field>

      <Field label="How many hours per week can you realistically dedicate to Coding Club activities?" required
        hint="Considering your classes, exams, and other commitments.">
        <div className="rec-radio-group" role="radiogroup" aria-label="Weekly hours">
          {HOURS_OPTIONS.map((o) => (
            <label key={o} className="rec-radio-item">
              <input type="radio" name="weekly_hours" value={o}
                checked={data.weekly_hours === o}
                onChange={() => onChange({ weekly_hours: o })} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

// ─── Step 3: Team-specific questions ─────────────────────────────────────────

function DesignBranch({ data, onChange }: { data: DesignData; onChange: (d: Partial<DesignData>) => void }) {
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Design Team Questions</h2>
        <p className="rec-step-desc">Help us understand your design background and creativity.</p>
      </div>

      <Field label="Have you worked in a design team before?" required>
        <div className="rec-radio-group" role="radiogroup">
          {["Yes", "No"].map((o) => (
            <label key={o} className="rec-radio-item">
              <input type="radio" name="design_worked_before" value={o}
                checked={data.design_worked_before === o}
                onChange={() => onChange({ design_worked_before: o })} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Which tools have you used for designing?" required hint="Select all that apply.">
        <CheckboxGroup id="design_tools" options={DESIGN_TOOLS}
          selected={data.design_tools} onChange={(v) => onChange({ design_tools: v })} />
        {data.design_tools.includes("Other") && (
          <TextInput id="design_tools_other" value={data.design_tools_other}
            onChange={(v) => onChange({ design_tools_other: v })}
            placeholder="Please specify…" maxLength={200} />
        )}
      </Field>

      <Field label="Which of the following have you designed before?" required hint="Select all that apply.">
        <CheckboxGroup id="design_past_work" options={DESIGN_PAST_WORK}
          selected={data.design_past_work} onChange={(v) => onChange({ design_past_work: v })} />
      </Field>

      <Field label="Upload one design you've created" hint="Max 15 MB. Supported: JPG, PNG, GIF, WebP, SVG, PDF.">
        <input
          id="design_file"
          type="file"
          className="rec-file-input"
          accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf"
          onChange={(e) => onChange({ design_file: e.target.files?.[0] ?? null })}
          aria-label="Upload your best design (max 15 MB)"
        />
        {data.design_file && (
          <p className="rec-file-name">
            Selected: {data.design_file.name}{" "}
            ({(data.design_file.size / 1024 / 1024).toFixed(1)} MB)
          </p>
        )}
      </Field>

      <Field label="Link to a design you admire (even if you didn't create it)"
        hint="Paste a URL — any platform works.">
        <TextInput id="design_admired_url" type="url" value={data.design_admired_url}
          onChange={(v) => onChange({ design_admired_url: v })}
          placeholder="https://dribbble.com/shots/…" maxLength={500} />
      </Field>

      <Field label="What specifically makes that design effective?" required>
        <Textarea id="design_admired_explain" value={data.design_admired_explain}
          onChange={(v) => onChange({ design_admired_explain: v })} rows={4}
          placeholder="Describe the composition, color palette, typography choices…" maxLength={2000} required />
      </Field>

      <Field label="Name one brand, designer, or creative account whose visual style you like." required>
        <TextInput id="design_brand_name" value={data.design_brand_name}
          onChange={(v) => onChange({ design_brand_name: v })}
          placeholder="E.g. Apple Design, Pentagram, @studio.mds…" maxLength={500} required />
      </Field>

      <Field label="What do you like about their work?" required>
        <Textarea id="design_brand_why" value={data.design_brand_why}
          onChange={(v) => onChange({ design_brand_why: v })} rows={3}
          placeholder="What about their approach resonates with you?" maxLength={2000} required />
      </Field>

      <Field label="Where do you usually find inspiration for your designs?" required>
        <Textarea id="design_inspiration" value={data.design_inspiration}
          onChange={(v) => onChange({ design_inspiration: v })} rows={3}
          placeholder="Dribbble, Pinterest, nature, architecture, music…" maxLength={2000} required />
      </Field>

      <Field label="How do you use AI tools in your design process?" required
        hint="Include which tools you've tried (e.g. Adobe Firefly, Midjourney, Canva AI).">
        <Textarea id="design_ai_tools" value={data.design_ai_tools}
          onChange={(v) => onChange({ design_ai_tools: v })} rows={3}
          placeholder="I use… / I haven't yet, but I'm curious about…" maxLength={2000} required />
      </Field>

      <Field label="How would you maintain a consistent visual identity across posters, ID cards, and merchandise?" required>
        <Textarea id="design_consistency" value={data.design_consistency}
          onChange={(v) => onChange({ design_consistency: v })} rows={4}
          placeholder="Describe your approach to brand consistency…" maxLength={2000} required />
      </Field>

      <Field label="You have limited time to finish a poster, an Instagram post, and an ID card." required
        hint="How would you prioritise and manage the work?">
        <Textarea id="design_prioritise" value={data.design_prioritise}
          onChange={(v) => onChange({ design_prioritise: v })} rows={4}
          placeholder="Walk us through your thought process and time management…" maxLength={2000} required />
      </Field>

      <Field label="What interests you about joining the Coding Club's Design Team?" required
        hint="What do you hope to gain from the experience, and how would you contribute?">
        <Textarea id="design_interest" value={data.design_interest}
          onChange={(v) => onChange({ design_interest: v })} rows={5}
          placeholder="Share what excites you and what you'd bring to the team…" maxLength={3000} required />
      </Field>
    </div>
  );
}

function MarketingBranch({ data, onChange }: { data: MarketingData; onChange: (d: Partial<MarketingData>) => void }) {
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Marketing Team Questions</h2>
        <p className="rec-step-desc">Tell us about your content creation and marketing mindset.</p>
      </div>

      <Field label="Which areas of marketing interest you?" required hint="Select all that apply.">
        <CheckboxGroup id="marketing_areas" options={MARKETING_AREAS}
          selected={data.marketing_areas} onChange={(v) => onChange({ marketing_areas: v })} />
        {data.marketing_areas.includes("Other") && (
          <TextInput id="marketing_areas_other" value={data.marketing_areas_other}
            onChange={(v) => onChange({ marketing_areas_other: v })}
            placeholder="Please specify…" maxLength={200} />
        )}
      </Field>

      <Field label="What platforms do you use for content creation / marketing?" required>
        <Textarea id="marketing_platforms" value={data.marketing_platforms}
          onChange={(v) => onChange({ marketing_platforms: v })} rows={2}
          placeholder="Instagram, LinkedIn, YouTube, Canva, CapCut…" maxLength={1000} required />
      </Field>

      <Field label="Do you have any experience in marketing / content creation?" required
        hint="Explain in 50 words.">
        <Textarea id="marketing_experience" value={data.marketing_experience}
          onChange={(v) => onChange({ marketing_experience: v })} rows={3}
          placeholder="Briefly describe your experience (max 50 words)…" maxLength={600} required />
      </Field>

      <Field label="Kindly attach links to videos of your previous content creation / marketing projects."
        hint="Paste links, one per line. Leave blank if not applicable.">
        <Textarea id="marketing_portfolio_links" value={data.marketing_portfolio_links}
          onChange={(v) => onChange({ marketing_portfolio_links: v })} rows={3}
          allowPaste={true}
          placeholder="https://instagram.com/reel/…&#10;https://youtube.com/watch?v=…" maxLength={2000} />
      </Field>

      <Field label="What makes you think you should join the Marketing team specifically?" required>
        <Textarea id="marketing_why" value={data.marketing_why}
          onChange={(v) => onChange({ marketing_why: v })} rows={4}
          placeholder="What unique perspective or skill do you bring?" maxLength={2000} required />
      </Field>

      <Field label="Imagine we are hosting a hackathon. How would you promote it to increase registrations?" required>
        <Textarea id="marketing_hackathon_promo" value={data.marketing_hackathon_promo}
          onChange={(v) => onChange({ marketing_hackathon_promo: v })} rows={5}
          placeholder="Walk us through your promotion strategy…" maxLength={2000} required />
      </Field>

      <Field label="What's one thing you'd change or improve about how the Coding Club currently operates or promotes itself?" required>
        <Textarea id="marketing_improve" value={data.marketing_improve}
          onChange={(v) => onChange({ marketing_improve: v })} rows={4}
          placeholder="Be specific and constructive…" maxLength={2000} required />
      </Field>
    </div>
  );
}

function EventsBranch({ data, onChange }: { data: EventsData; onChange: (d: Partial<EventsData>) => void }) {
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Events & Operations Questions</h2>
        <p className="rec-step-desc">Show us how you think under pressure and plan for success.</p>
      </div>

      <Field label="Wi-Fi crash scenario" required
        hint="You are managing the registration desk for our flagship hackathon. Fifteen minutes before kickoff, the main Wi-Fi network crashes, and 200 participants are waiting outside. What is your immediate, step-by-step plan to handle the situation?">
        <Textarea id="events_wifi_crash" value={data.events_wifi_crash}
          onChange={(v) => onChange({ events_wifi_crash: v })} rows={6}
          placeholder="Step 1: Immediately notify…" maxLength={3000} required />
      </Field>

      <Field label="Engagement initiative" required
        hint="Coding Club workshops often start with high attendance, but participation drops after a few sessions. Propose one creative, low-budget initiative to keep students consistently engaged and attending our workshops and events.">
        <Textarea id="events_engagement" value={data.events_engagement}
          onChange={(v) => onChange({ events_engagement: v })} rows={5}
          placeholder="My initiative idea is…" maxLength={3000} required />
      </Field>

      <Field label="Conflicting priorities" required
        hint="College life involves balancing exams, assignments, and club events. Describe a time you faced conflicting priorities. How did you organise your time, and how did you respond when things didn't go as planned?">
        <Textarea id="events_priorities" value={data.events_priorities}
          onChange={(v) => onChange({ events_priorities: v })} rows={5}
          placeholder="A specific situation I faced was…" maxLength={3000} required />
      </Field>

      <Field label="Unresponsive teammate" required
        hint="You are paired with a team member who has stopped responding to messages and hasn't completed their assigned event tasks, just 48 hours before the event. How would you handle the situation constructively?">
        <Textarea id="events_teammate" value={data.events_teammate}
          onChange={(v) => onChange({ events_teammate: v })} rows={5}
          placeholder="First, I would…" maxLength={3000} required />
      </Field>

      <Field label="High-stakes deadline" required
        hint="A high-stakes club deadline is 24 hours away. Your tasks are complete, but another department (Tech, Design, or Marketing) is severely short-staffed. You have no prior experience in their domain. How would you respond?">
        <Textarea id="events_highstakes" value={data.events_highstakes}
          onChange={(v) => onChange({ events_highstakes: v })} rows={5}
          placeholder="I would first assess…" maxLength={3000} required />
      </Field>

      <Field label="Why Events & Operations — and your event idea" required
        hint="Why do you want to join the Events & Operations Team specifically, rather than the Technical or Design Team? What is one unique event idea you'd love to bring to the Coding Club this year?">
        <Textarea id="events_why" value={data.events_why}
          onChange={(v) => onChange({ events_why: v })} rows={5}
          placeholder="I chose Events & Ops because… My event idea is…" maxLength={3000} required />
      </Field>
    </div>
  );
}

function TechnicalBranch({ data, onChange }: { data: TechnicalData; onChange: (d: Partial<TechnicalData>) => void }) {
  const wantsDsa = data.tech_domains.includes("Data Structures & Algorithms (DSA)");
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Technical Team Questions</h2>
        <p className="rec-step-desc">Share your technical interests, projects, and approach to problem-solving.</p>
      </div>

      <Field label="Which technical domains are you interested in or have experience with?" required hint="Select all that apply.">
        <CheckboxGroup id="tech_domains" options={TECH_DOMAINS}
          selected={data.tech_domains} onChange={(v) => onChange({ tech_domains: v })} />
        {data.tech_domains.includes("Other") && (
          <TextInput id="tech_domains_other" value={data.tech_domains_other}
            onChange={(v) => onChange({ tech_domains_other: v })}
            placeholder="Please specify…" maxLength={200} />
        )}
      </Field>

      <Field label="Share your GitHub profile URL" required hint="If you don't have one, write N/A.">
        <TextInput id="tech_github" value={data.tech_github}
          onChange={(v) => onChange({ tech_github: v })}
          placeholder="https://github.com/username or N/A" maxLength={500} required />
      </Field>

      <Field label="Share your portfolio or personal website URL" hint="If not available, write N/A.">
        <TextInput id="tech_portfolio" value={data.tech_portfolio}
          onChange={(v) => onChange({ tech_portfolio: v })}
          placeholder="https://yourportfolio.dev or N/A" maxLength={500} />
      </Field>

      {wantsDsa && (
        <Field label="Your coding profiles (for DSA)" required
          hint="Include platforms like LeetCode, Codeforces, CodeChef, GeeksforGeeks, HackerRank.">
          <Textarea id="tech_dsa_profiles" value={data.tech_dsa_profiles}
            onChange={(v) => onChange({ tech_dsa_profiles: v })} rows={3}
            allowPaste={true}
            placeholder="LeetCode: https://…&#10;Codeforces: https://…" maxLength={1000} required />
        </Field>
      )}

      <Field label="Tell us about the technical projects you've built or contributed to." required
        hint="Mention the problem, technologies used, and your role. If you haven't built any projects yet, what would you like to build?">
        <Textarea id="tech_projects" value={data.tech_projects}
          onChange={(v) => onChange({ tech_projects: v })} rows={6}
          placeholder="Project 1: I built a… using… My role was…" maxLength={3000} required />
      </Field>

      <Field label="Describe a technical challenge you faced while building a project or solving a coding problem." required
        hint="How did you approach it?">
        <Textarea id="tech_challenge" value={data.tech_challenge}
          onChange={(v) => onChange({ tech_challenge: v })} rows={5}
          placeholder="The challenge I faced was… I approached it by…" maxLength={3000} required />
      </Field>

      <Field label="Why do you want to join the Coding Club's Technical Team?" required
        hint="What would you like to contribute?">
        <Textarea id="tech_why" value={data.tech_why}
          onChange={(v) => onChange({ tech_why: v })} rows={4}
          placeholder="I want to join because… I'd contribute by…" maxLength={3000} required />
      </Field>
    </div>
  );
}

function OutreachBranch({ data, onChange }: { data: OutreachData; onChange: (d: Partial<OutreachData>) => void }) {
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Outreach & Sponsorship Questions</h2>
        <p className="rec-step-desc">Show us your networking instincts and strategic thinking.</p>
      </div>

      <Field label="Have you previously worked in outreach, corporate relations, sponsorships, or partnerships?" required
        hint="If yes, briefly describe your experience. If not, write N/A.">
        <Textarea id="outreach_experience" value={data.outreach_experience}
          onChange={(v) => onChange({ outreach_experience: v })} rows={4}
          placeholder="Yes, I worked at… / N/A" maxLength={3000} required />
      </Field>

      <Field label="Securing a sponsor for our hackathon" required
        hint="How would you identify suitable companies and approach them to secure sponsorship?">
        <Textarea id="outreach_sponsor_approach" value={data.outreach_sponsor_approach}
          onChange={(v) => onChange({ outreach_sponsor_approach: v })} rows={5}
          placeholder="I would start by identifying… then reach out by…" maxLength={3000} required />
      </Field>

      <Field label="A company hasn't responded to your sponsorship email after a week. What would you do next?" required>
        <Textarea id="outreach_no_response" value={data.outreach_no_response}
          onChange={(v) => onChange({ outreach_no_response: v })} rows={4}
          placeholder="First, I would send a follow-up…" maxLength={3000} required />
      </Field>

      <Field label="Your task: contact tech companies and secure at least one sponsor for an upcoming event." required
        hint="How would you plan and execute this task?">
        <Textarea id="outreach_task" value={data.outreach_task}
          onChange={(v) => onChange({ outreach_task: v })} rows={5}
          placeholder="My plan would be: Step 1…" maxLength={3000} required />
      </Field>

      <Field label="Why do you want to join the Outreach & Sponsorship Team?" required
        hint="What skills or strengths would make you suitable for this role?">
        <Textarea id="outreach_why" value={data.outreach_why}
          onChange={(v) => onChange({ outreach_why: v })} rows={4}
          placeholder="I want to join because… My key strengths are…" maxLength={3000} required />
      </Field>
    </div>
  );
}

// ─── Step 4: Review & Submit ──────────────────────────────────────────────────

function ReviewStep({ common, teamLabel }: { common: CommonData; teamLabel: string }) {
  return (
    <div className="rec-step">
      <div className="rec-step-intro">
        <h2 className="rec-step-title">Review Your Application</h2>
        <p className="rec-step-desc">
          Please review the details below before submitting. Once submitted,
          you cannot resubmit for the same cycle with the same college email.
        </p>
      </div>

      <div className="rec-review-card">
        <ReviewRow label="Name" value={common.full_name} />
        <ReviewRow label="Personal Email" value={common.email} />
        <ReviewRow label="College Email" value={common.college_email} />
        <ReviewRow label="Phone" value={common.phone} />
        <ReviewRow label="USN" value={common.usn} />
        <ReviewRow label="Year" value={common.year_of_study} />
        <ReviewRow label="Branch" value={common.branch} />
        <ReviewRow label="Applying For" value={teamLabel} />
        <ReviewRow label="Weekly Hours" value={common.weekly_hours} />
      </div>

      <div className="rec-declaration">
        <p>By submitting, I confirm that all information provided is accurate and complete.</p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rec-review-row">
      <span className="rec-review-label">{label}</span>
      <span className="rec-review-value">{value || "—"}</span>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ reference }: { reference: string }) {
  return (
    <div className="rec-success">
      <div className="rec-success__icon" aria-hidden="true">
        <CheckCircleIcon size={32} />
      </div>
      <h2 className="rec-success__title">Application Submitted!</h2>
      <p className="rec-success__desc">
        Your application has been received and saved. Our team will review it
        after the recruitment cycle closes.
      </p>
      <div className="rec-success__ref">
        <span className="rec-success__ref-label">Your Reference ID</span>
        <strong className="rec-success__ref-value" aria-label={`Reference ID: ${reference}`}>
          {reference}
        </strong>
        <p className="rec-success__ref-hint">
          Save this reference. We'll announce results on our social media after evaluations.
        </p>
      </div>
      <Link href="/" className="btn-primary rec-success__home">
        Back to Home
      </Link>
    </div>
  );
}

// ─── Closed screen ────────────────────────────────────────────────────────────

function ClosedScreen({
  onRefresh,
}: {
  onRefresh?: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleManualCheck = async () => {
    if (!onRefresh || checking) return;
    setChecking(true);
    setFeedback("");
    try {
      await onRefresh();
      setFeedback("Still closed — check back soon!");
      setTimeout(() => setFeedback(""), 3500);
    } catch {
      setFeedback("Couldn't reach server");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Auto-poll recruitment state every 20 seconds so that the page
    // automatically becomes active the moment recruitment opens
    if (!onRefresh) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 20000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  return (
    <div className="rec-closed">
      <div className="rec-closed__status-badge">
        <span className="rec-closed__pulse-dot" />
        <span>Applications closed</span>
      </div>

      <div className="rec-closed__icon" aria-hidden="true">
        <LockIcon size={28} />
      </div>

      <h1 className="rec-closed__title">Recruitments aren&apos;t open yet</h1>

      <p className="rec-closed__desc">
        We haven&apos;t kicked off this cycle yet. Once applications open, this page will
        automatically load the form so you can apply right away.
      </p>

      {/* Auto-update badge */}
      <div className="rec-closed__live-bar">
        <span>Auto-updates when registrations open</span>
        <button
          type="button"
          className="rec-closed__check-btn"
          onClick={handleManualCheck}
          disabled={checking}
          aria-label="Check if recruitment has opened"
        >
          {checking ? "Checking…" : "Refresh"}
        </button>
      </div>
      {feedback && (
        <p style={{ fontSize: 12, color: "var(--grey-500)", marginTop: -24, marginBottom: 24, fontFamily: "var(--font-mono)" }}>
          {feedback}
        </p>
      )}

      {/* Teams overview */}
      <div className="rec-closed__teams-section">
        <div className="rec-closed__teams-header">
          <h2 className="rec-closed__teams-title">Teams you can join</h2>
          <p className="rec-closed__teams-subtitle">
            You can apply to up to two teams per cycle. Take a look at what each team works on:
          </p>
        </div>

        <div className="rec-closed__teams-grid">
          {TEAMS.map((t) => (
            <div key={t.id} className="rec-closed__team-card">
              <div className="rec-closed__team-head">
                <div className="rec-closed__team-icon" aria-hidden="true">
                  <TeamIcon team={t.id} size={18} />
                </div>
                <span className="rec-closed__team-name">{t.label}</span>
              </div>
              <p className="rec-closed__team-desc">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Social channels */}
      <div className="rec-closed__socials-section">
        <span className="rec-closed__socials-label">// Stay in the loop</span>
        <p style={{ fontSize: 13, color: "var(--grey-600)", marginBottom: 14 }}>
          Dates, form drops, and shortlists will be posted first on our socials:
        </p>
        <div className="rec-closed__socials-links">
          <a
            href="https://www.instagram.com/codingclub_bmsit?igsh=bGlxdmEyOXpmb3Zo"
            target="_blank"
            rel="noopener noreferrer"
            className="rec-closed__social-chip"
          >
            Instagram ↗
          </a>
          <a
            href="https://www.linkedin.com/company/coding-club-bmsit/"
            target="_blank"
            rel="noopener noreferrer"
            className="rec-closed__social-chip"
          >
            LinkedIn ↗
          </a>
          <a
            href="https://github.com/Codingclub-BMSIT"
            target="_blank"
            rel="noopener noreferrer"
            className="rec-closed__social-chip"
          >
            GitHub ↗
          </a>
          <a
            href="https://x.com/_coding_club"
            target="_blank"
            rel="noopener noreferrer"
            className="rec-closed__social-chip"
          >
            X / Twitter ↗
          </a>
        </div>
      </div>

      {/* Action buttons */}
      <div className="rec-closed__actions">
        <Link href="/" className="btn-secondary">
          ← Back to home
        </Link>
        <Link href="/about" className="btn-secondary">
          About us
        </Link>
        <Link href="/events" className="btn-primary">
          Explore events
        </Link>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecruitmentPage() {
  const { state, ready, refresh } = useRecruitment();
  const [step, setStep] = useState(1); // 1=info, 2=role+shared, 3=team, 4=review
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [pasteToast, setPasteToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: "" });
  const pasteToastTimer = useRef<NodeJS.Timeout | null>(null);

  const handlePasteBlocked = useCallback((_fieldName?: string) => {
    setPasteToast({
      show: true,
      msg: "Copy-pasting is disabled for this question. To ensure authentic answers and prevent AI-generated responses, please type your thoughts directly.",
    });
    if (pasteToastTimer.current) clearTimeout(pasteToastTimer.current);
    pasteToastTimer.current = setTimeout(() => {
      setPasteToast({ show: false, msg: "" });
    }, 4500);
  }, []);

  const [common, setCommon] = useState<CommonData>({
    email: "", full_name: "", college_email: "", phone: "",
    usn: "", year_of_study: "", branch: "", selected_team: "",
    clubs_orgs: "", why_join: "", weekly_hours: "",
  });

  const [designData, setDesignData] = useState<DesignData>({
    design_worked_before: "", design_tools: [], design_tools_other: "",
    design_past_work: [], design_admired_url: "", design_admired_explain: "",
    design_brand_name: "", design_brand_why: "", design_inspiration: "",
    design_ai_tools: "", design_consistency: "", design_prioritise: "",
    design_interest: "", design_file: null,
  });
  const [marketingData, setMarketingData] = useState<MarketingData>({
    marketing_areas: [], marketing_areas_other: "", marketing_platforms: "",
    marketing_experience: "", marketing_portfolio_links: "", marketing_why: "",
    marketing_hackathon_promo: "", marketing_improve: "",
  });
  const [eventsData, setEventsData] = useState<EventsData>({
    events_wifi_crash: "", events_engagement: "", events_priorities: "",
    events_teammate: "", events_highstakes: "", events_why: "",
  });
  const [technicalData, setTechnicalData] = useState<TechnicalData>({
    tech_domains: [], tech_domains_other: "", tech_github: "", tech_portfolio: "",
    tech_dsa_profiles: "", tech_projects: "", tech_challenge: "", tech_why: "",
  });
  const [outreachData, setOutreachData] = useState<OutreachData>({
    outreach_experience: "", outreach_sponsor_approach: "",
    outreach_no_response: "", outreach_task: "", outreach_why: "",
  });

  // Scroll to top on step change
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const updateCommon = useCallback((d: Partial<CommonData>) => setCommon((p) => ({ ...p, ...d })), []);

  const totalSteps = 4;

  function validateStep(): string | null {
    if (step === 1) {
      if (!common.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(common.email)) return "Please enter a valid email.";
      if (!common.full_name.trim()) return "Full name is required.";
      if (!common.college_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(common.college_email)) return "Please enter a valid college email.";
      if (!common.phone.trim()) return "Phone number is required.";
      if (!common.usn.trim()) return "USN is required.";
      if (!common.year_of_study) return "Please select your year of study.";
      if (!common.branch) return "Please select your branch.";
    }
    if (step === 2) {
      if (!common.selected_team) return "Please select a team to apply for.";
      if (!common.clubs_orgs.trim()) return "Please fill in the clubs/orgs field.";
      if (!common.why_join.trim()) return "Please explain why you want to join.";
      if (!common.weekly_hours) return "Please select your weekly availability.";
    }
    if (step === 3) {
      if (common.selected_team === "design") {
        if (!designData.design_worked_before) return "Please answer the first design question.";
        if (designData.design_tools.length === 0) return "Please select at least one design tool.";
        if (designData.design_past_work.length === 0) return "Please select at least one past work type.";
        if (!designData.design_admired_explain.trim()) return "Please explain what makes the admired design effective.";
        if (!designData.design_brand_name.trim()) return "Please name a brand or designer you like.";
        if (!designData.design_brand_why.trim()) return "Please explain what you like about their work.";
        if (!designData.design_inspiration.trim()) return "Please share where you find inspiration.";
        if (!designData.design_ai_tools.trim()) return "Please describe your use of AI tools.";
        if (!designData.design_consistency.trim()) return "Please explain your approach to visual consistency.";
        if (!designData.design_prioritise.trim()) return "Please answer the prioritisation question.";
        if (!designData.design_interest.trim()) return "Please share your interest in the Design Team.";
      }
      if (common.selected_team === "marketing") {
        if (marketingData.marketing_areas.length === 0) return "Please select at least one marketing area.";
        if (!marketingData.marketing_platforms.trim()) return "Please list the platforms you use.";
        if (!marketingData.marketing_experience.trim()) return "Please describe your marketing experience.";
        if (!marketingData.marketing_why.trim()) return "Please explain why you want to join Marketing.";
        if (!marketingData.marketing_hackathon_promo.trim()) return "Please answer the hackathon promotion question.";
        if (!marketingData.marketing_improve.trim()) return "Please answer the improvement question.";
      }
      if (common.selected_team === "events_ops") {
        if (!eventsData.events_wifi_crash.trim()) return "Please answer the Wi-Fi crash scenario.";
        if (!eventsData.events_engagement.trim()) return "Please answer the engagement initiative question.";
        if (!eventsData.events_priorities.trim()) return "Please answer the conflicting priorities question.";
        if (!eventsData.events_teammate.trim()) return "Please answer the unresponsive teammate scenario.";
        if (!eventsData.events_highstakes.trim()) return "Please answer the high-stakes deadline question.";
        if (!eventsData.events_why.trim()) return "Please explain why you want to join Events & Ops.";
      }
      if (common.selected_team === "technical") {
        if (technicalData.tech_domains.length === 0) return "Please select at least one technical domain.";
        if (!technicalData.tech_github.trim()) return "Please enter your GitHub URL or N/A.";
        if (!technicalData.tech_projects.trim()) return "Please describe your technical projects.";
        if (!technicalData.tech_challenge.trim()) return "Please describe a technical challenge you faced.";
        if (!technicalData.tech_why.trim()) return "Please explain why you want to join the Technical Team.";
      }
      if (common.selected_team === "outreach_sponsorship") {
        if (!outreachData.outreach_experience.trim()) return "Please answer the experience question.";
        if (!outreachData.outreach_sponsor_approach.trim()) return "Please answer the sponsor approach question.";
        if (!outreachData.outreach_no_response.trim()) return "Please answer the no-response follow-up question.";
        if (!outreachData.outreach_task.trim()) return "Please answer the outreach task question.";
        if (!outreachData.outreach_why.trim()) return "Please explain why you want to join Outreach.";
      }
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, totalSteps));
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    try {
      // Build team responses object
      let teamResponses: Record<string, unknown> = {};
      const team = common.selected_team as Team;

      if (team === "design") {
        teamResponses = {
          design_worked_before: designData.design_worked_before,
          design_tools: [
            ...designData.design_tools.filter((t) => t !== "Other"),
            ...(designData.design_tools.includes("Other") && designData.design_tools_other ? [designData.design_tools_other] : []),
          ],
          design_past_work: designData.design_past_work,
          design_admired_url: designData.design_admired_url,
          design_admired_explain: designData.design_admired_explain,
          design_brand_name: designData.design_brand_name,
          design_brand_why: designData.design_brand_why,
          design_inspiration: designData.design_inspiration,
          design_ai_tools: designData.design_ai_tools,
          design_consistency: designData.design_consistency,
          design_prioritise: designData.design_prioritise,
          design_interest: designData.design_interest,
        };
      } else if (team === "marketing") {
        teamResponses = {
          marketing_areas: [
            ...marketingData.marketing_areas.filter((a) => a !== "Other"),
            ...(marketingData.marketing_areas.includes("Other") && marketingData.marketing_areas_other ? [marketingData.marketing_areas_other] : []),
          ],
          marketing_platforms: marketingData.marketing_platforms,
          marketing_experience: marketingData.marketing_experience,
          marketing_portfolio_links: marketingData.marketing_portfolio_links,
          marketing_why: marketingData.marketing_why,
          marketing_hackathon_promo: marketingData.marketing_hackathon_promo,
          marketing_improve: marketingData.marketing_improve,
        };
      } else if (team === "events_ops") {
        teamResponses = { ...eventsData };
      } else if (team === "technical") {
        teamResponses = {
          tech_domains: [
            ...technicalData.tech_domains.filter((d) => d !== "Other"),
            ...(technicalData.tech_domains.includes("Other") && technicalData.tech_domains_other ? [technicalData.tech_domains_other] : []),
          ],
          tech_github: technicalData.tech_github,
          tech_portfolio: technicalData.tech_portfolio || "N/A",
          tech_dsa_profiles: technicalData.tech_dsa_profiles,
          tech_projects: technicalData.tech_projects,
          tech_challenge: technicalData.tech_challenge,
          tech_why: technicalData.tech_why,
        };
      } else if (team === "outreach_sponsorship") {
        teamResponses = { ...outreachData };
      }

      const formData = new FormData();
      formData.append("email", common.email);
      formData.append("full_name", common.full_name);
      formData.append("college_email", common.college_email);
      formData.append("phone", common.phone);
      formData.append("usn", common.usn);
      formData.append("year_of_study", common.year_of_study);
      formData.append("branch", common.branch);
      formData.append("selected_team", common.selected_team);
      formData.append("clubs_orgs", common.clubs_orgs);
      formData.append("why_join", common.why_join);
      formData.append("weekly_hours", common.weekly_hours);
      formData.append("team_responses", JSON.stringify(teamResponses));

      if (team === "design" && designData.design_file) {
        formData.append("design_file", designData.design_file);
      }

      const res = await fetch(`${API_BASE}/recruitment/apply`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Submission failed (${res.status})`);
      }

      setSuccessRef(data.reference || data.application_id?.slice(0, 8).toUpperCase() || "APP");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Not yet loaded
  if (!ready) {
    return (
      <main className="rec-page">
        <div className="rec-loading">
          <div className="rec-loading__spinner" aria-label="Loading recruitment status…" />
        </div>
      </main>
    );
  }

  // Recruitment closed
  if (!state?.is_open) {
    return (
      <main className="rec-page">
        <ClosedScreen onRefresh={refresh} />
      </main>
    );
  }

  // Success
  if (successRef) {
    return (
      <main className="rec-page">
        <SuccessScreen reference={successRef} />
      </main>
    );
  }

  const teamObj = TEAMS.find((t) => t.id === common.selected_team);

  return (
    <main className="rec-page" ref={topRef}>
      {/* Page header */}
      <section className="rec-hero">
        <div className="rec-hero__badge">Applications Open</div>
        <h1 className="rec-hero__title">Join the Coding Club</h1>
        <p className="rec-hero__subtitle">
          {state.title} — Students interested in technology, creativity, community building,
          or organising events are invited to join.
        </p>
      </section>

      {/* Progress bar */}
      <div className="rec-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps}
        aria-label={`Application step ${step} of ${totalSteps}`}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`rec-progress__step ${i + 1 <= step ? "rec-progress__step--done" : ""}`}>
            <div className="rec-progress__dot" />
            <span className="rec-progress__label">
              {["Personal Info", "Role Selection", teamObj?.label ?? "Team Questions", "Review"][i]}
            </span>
          </div>
        ))}
        <div className="rec-progress__bar" style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }} />
      </div>

      {/* Form content */}
      <AntiPasteContext.Provider value={{ onPasteBlocked: handlePasteBlocked }}>
        <div className="rec-form-container">
          {(step === 2 || step === 3) && (
            <div className="rec-integrity-banner">
              <div className="rec-integrity-banner__icon" aria-hidden="true">
                <ShieldIcon size={18} />
              </div>
              <div>
                <div className="rec-integrity-banner__title">Authenticity Notice — Direct Typing Required</div>
                <p className="rec-integrity-banner__text">
                  To prevent AI-generated submissions and evaluate genuine passion, copy-pasting is disabled on written answers.
                  You can freely paste links &amp; URLs into link fields.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rec-error" role="alert" aria-live="assertive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

        {step === 1 && <Step1 data={common} onChange={updateCommon} />}
        {step === 2 && <Step2 data={common} onChange={updateCommon} />}
        {step === 3 && common.selected_team === "design" && (
          <DesignBranch data={designData} onChange={(d) => setDesignData((p) => ({ ...p, ...d }))} />
        )}
        {step === 3 && common.selected_team === "marketing" && (
          <MarketingBranch data={marketingData} onChange={(d) => setMarketingData((p) => ({ ...p, ...d }))} />
        )}
        {step === 3 && common.selected_team === "events_ops" && (
          <EventsBranch data={eventsData} onChange={(d) => setEventsData((p) => ({ ...p, ...d }))} />
        )}
        {step === 3 && common.selected_team === "technical" && (
          <TechnicalBranch data={technicalData} onChange={(d) => setTechnicalData((p) => ({ ...p, ...d }))} />
        )}
        {step === 3 && common.selected_team === "outreach_sponsorship" && (
          <OutreachBranch data={outreachData} onChange={(d) => setOutreachData((p) => ({ ...p, ...d }))} />
        )}
        {step === 4 && (
          <ReviewStep common={common} teamLabel={teamObj?.label ?? common.selected_team} />
        )}

        {/* Navigation */}
        <div className="rec-nav">
          {step > 1 && (
            <button type="button" className="btn-secondary" onClick={handleBack} disabled={submitting}
              id="rec-back-btn">
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < totalSteps ? (
            <button type="button" className="btn-primary" onClick={handleNext}
              id="rec-next-btn">
              Next →
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary rec-submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
              id="rec-submit-btn"
            >
              {submitting ? (
                <><span className="rec-spinner" aria-hidden="true" /> Submitting…</>
              ) : (
                "Submit Application"
              )}
            </button>
          )}
        </div>

        <p className="rec-footnote">
          Fields marked <span aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required.
          Your application is saved to our secure database immediately upon submission.
        </p>
      </div>
    </AntiPasteContext.Provider>

    {/* Floating anti-paste alert toast */}
    {pasteToast.show && (
      <div className="rec-paste-toast" role="alert">
        <div className="rec-paste-toast-inner">
          <span className="rec-paste-toast-icon" aria-hidden="true">
            <ShieldIcon size={18} />
          </span>
          <div className="rec-paste-toast-content">
            <strong>Pasting is disabled for this answer</strong>
            <p>{pasteToast.msg}</p>
          </div>
          <button
            type="button"
            className="rec-paste-toast-close"
            onClick={() => setPasteToast({ show: false, msg: "" })}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      </div>
    )}
  </main>
);
}
