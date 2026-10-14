"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { roleAtLeast, isCoreHeadPlus } from "@/app/lib/roles";
import type { BuilderRepo, BuilderRepoCategory, BuilderRepoStatus } from "@/app/lib/types";
import {
  Spinner,
  EmptyState,
  PageHeader,
  FormError,
  FormSuccess,
  Modal,
  Field,
} from "@/app/components/app/ui";

// ─── constants ─────────────────────────────────────────────────────────────

const CATEGORIES: { value: BuilderRepoCategory | ""; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "web", label: "Web" },
  { value: "ai", label: "AI / ML" },
  { value: "mobile", label: "Mobile" },
  { value: "open-source", label: "Open Source" },
  { value: "cli", label: "CLI / Tools" },
  { value: "api", label: "API / Backend" },
  { value: "game", label: "Game" },
  { value: "other", label: "Other" },
];

// ─── page ──────────────────────────────────────────────────────────────────

export default function BuildersPage() {
  const { user, ready, openAuth } = useAuth();
  const [repos, setRepos] = useState<BuilderRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<BuilderRepoCategory | "">("");
  const [seekingOnly, setSeekingOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BuilderRepoStatus | "all" | "">("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<BuilderRepo | null>(null);

  const canSubmit = ready && !!user && roleAtLeast(user.role, "member");
  const isReviewer = ready && !!user && isCoreHeadPlus(user);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (catFilter) params.set("category", catFilter);
      if (seekingOnly) params.set("seeking", "1");
      if (statusFilter && isReviewer) params.set("status", statusFilter);
      else if (canSubmit && !isReviewer) params.set("status", "all");
      const q = params.toString() ? "?" + params.toString() : "";
      const data = await api<{ repos: BuilderRepo[] }>(`/builders${q}`);
      setRepos(data.repos);
    } catch {
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (ready) load(); }, [ready, catFilter, seekingOnly, statusFilter]);

  return (
    <div className="page">
      <div className="section-inner section-inner-wide">

        <PageHeader
          eyebrow="// BMSIT Builders"
          title="Open source,"
          ghost="built here."
          sub="Discover real projects from club members. Fork a repo, raise a PR, and start contributing today."
          actions={
            canSubmit ? (
              <button className="btn-primary" onClick={() => setShowSubmit(true)} id="submit-repo-btn">
                + Submit your repo
              </button>
            ) : ready && !user ? (
              <button className="btn-primary" onClick={() => openAuth("login")} id="builders-signin-btn">
                Sign in to submit
              </button>
            ) : undefined
          }
        />

        {/* ── Filter bar ── */}
        <div style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          padding: "14px 20px",
          background: "var(--grey-50)",
          border: "1px solid var(--grey-100)",
          borderRadius: 14,
          marginBottom: 36,
        }}>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as BuilderRepoCategory | "")}
            className="select"
            style={{ width: "auto", padding: "7px 12px", fontSize: 13 }}
            aria-label="Filter by category"
            id="builders-category-filter"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {isReviewer && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BuilderRepoStatus | "all" | "")}
              className="select"
              style={{ width: "auto", padding: "7px 12px", fontSize: 13 }}
              aria-label="Filter by status"
              id="builders-status-filter"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--grey-600)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={seekingOnly}
              onChange={(e) => setSeekingOnly(e.target.checked)}
              id="builders-seeking-filter"
            />
            Seeking contributors
          </label>

          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {loading ? "Loading…" : `${repos.length} project${repos.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div style={{ padding: "64px 0" }}><Spinner /></div>
        ) : repos.length === 0 ? (
          <EmptyState
            title="No repos yet"
            body={canSubmit
              ? "Be the first to submit a project to BMSIT Builders!"
              : "Check back soon — club members are building cool stuff."}
            action={canSubmit
              ? <button className="btn-primary" onClick={() => setShowSubmit(true)}>Submit your repo</button>
              : undefined}
          />
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 22,
          }}>
            {repos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                isReviewer={!!isReviewer}
                currentUserId={user?.id}
                onReview={(r) => setSelectedRepo(r)}
                onDelete={load}
              />
            ))}
          </div>
        )}
      </div>

      {showSubmit && (
        <SubmitModal
          onClose={() => setShowSubmit(false)}
          onSuccess={() => { setShowSubmit(false); load(); }}
        />
      )}
      {selectedRepo && isReviewer && (
        <ReviewModal
          repo={selectedRepo}
          onClose={() => setSelectedRepo(null)}
          onSuccess={() => { setSelectedRepo(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── repo card ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BuilderRepoStatus }) {
  const colors: Record<BuilderRepoStatus, { bg: string; color: string; border: string }> = {
    pending:  { bg: "rgba(212,160,23,0.08)",  color: "#a07800", border: "rgba(212,160,23,0.3)" },
    approved: { bg: "rgba(30,126,52,0.07)",   color: "#1e7e34", border: "rgba(30,126,52,0.25)" },
    rejected: { bg: "rgba(192,57,43,0.07)",   color: "#c0392b", border: "rgba(192,57,43,0.25)" },
  };
  const c = colors[status];
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.1em",
      padding: "3px 8px", borderRadius: 100,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {status}
    </span>
  );
}

function RepoCard({
  repo,
  isReviewer,
  currentUserId,
  onReview,
  onDelete,
}: {
  repo: BuilderRepo;
  isReviewer: boolean;
  currentUserId?: number;
  onReview: (r: BuilderRepo) => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const isOwner = currentUserId === repo.submitted_by;
  const canDelete = isReviewer || (isOwner && repo.status === "pending");

  async function handleDelete() {
    if (!confirm(`Remove "${repo.repo_name}" from Builders?`)) return;
    setDeleting(true);
    try {
      await api(`/builders/${repo.id}`, { method: "DELETE" });
      onDelete();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card card-hover" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "22px 24px" }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--grey-500)",
          }}>
            {repo.category}
          </span>
          {(isReviewer || isOwner) && repo.status !== "approved" && (
            <StatusBadge status={repo.status} />
          )}
          {isOwner && repo.status === "pending" && !isReviewer && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#a07800", fontWeight: 600 }}>Your submission</span>
          )}
        </div>
      </div>

      {/* Title + author */}
      <div>
        <div className="card-title" style={{ fontSize: 18, marginBottom: 3 }}>{repo.repo_name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", letterSpacing: "0.05em" }}>
          by {repo.submitter_name ?? "Anonymous"}
        </div>
      </div>

      {/* Description */}
      <p className="card-muted" style={{ flexGrow: 1, lineHeight: 1.55 }}>
        {repo.description.length > 130 ? repo.description.slice(0, 130) + "…" : repo.description}
      </p>

      {/* Tags */}
      {repo.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {repo.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="badge">#{tag}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap", paddingTop: 12, borderTop: "1px dashed var(--grey-100)" }}>
        <a
          href={repo.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary btn-sm"
          style={{ gap: 5, display: "inline-flex", alignItems: "center" }}
          id={`repo-github-link-${repo.id}`}
        >
          <GithubIcon size={13} /> GitHub
        </a>
        {repo.looking_for_contributors && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            color: "#1e7e34", letterSpacing: "0.06em", textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1e7e34", display: "inline-block" }} />
            Seeking contributors
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {isReviewer && repo.status === "pending" && (
            <button
              className="btn-secondary btn-sm"
              onClick={() => onReview(repo)}
              id={`review-repo-${repo.id}`}
            >
              Review
            </button>
          )}
          {canDelete && (
            <button
              className="btn-secondary btn-sm btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              id={`delete-repo-${repo.id}`}
            >
              {deleting ? "…" : "Remove"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── submit modal ──────────────────────────────────────────────────────────

function SubmitModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState<BuilderRepoCategory>("web");
  const [seeking, setSeeking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await api("/builders", {
        method: "POST",
        body: {
          repo_name: repoName,
          repo_url: repoUrl,
          description,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          category,
          looking_for_contributors: seeking,
        },
      });
      setSuccess("Submitted! Core heads will review your repo soon.");
      setTimeout(onSuccess, 1800);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title="Submit your repo" onClose={onClose}>
      <p style={{ fontSize: 14, color: "var(--grey-500)", marginBottom: 24, lineHeight: 1.6 }}>
        Share your GitHub project with the BMSIT coding community. Core heads
        will review and approve it for the listing. Only public GitHub repos are accepted.
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="Project / Repo name" required>
          <input
            className="input"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="My Awesome Project"
            maxLength={100}
            required
            id="submit-repo-name"
          />
        </Field>
        <Field label="GitHub repo URL" required hint="Must be a public GitHub repository (https://github.com/user/repo)">
          <input
            className="input"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/your-username/your-repo"
            type="url"
            required
            id="submit-repo-url"
          />
        </Field>
        <Field label="Description" required hint="Tell people what your project does (10–1000 chars)">
          <textarea
            className="input textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of your project..."
            rows={3}
            maxLength={1000}
            required
            id="submit-repo-description"
          />
        </Field>
        <Field label="Category">
          <select
            className="input select"
            value={category}
            onChange={(e) => setCategory(e.target.value as BuilderRepoCategory)}
            id="submit-repo-category"
          >
            {CATEGORIES.filter((c) => c.value).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Tags" hint="Comma-separated — e.g. react, typescript, open-source">
          <input
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="react, typescript, open-source"
            id="submit-repo-tags"
          />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 20, fontSize: 14, color: "var(--grey-700)" }}>
          <input
            type="checkbox"
            checked={seeking}
            onChange={(e) => setSeeking(e.target.checked)}
            id="submit-repo-seeking"
          />
          I am looking for contributors
        </label>

        <FormError>{error}</FormError>
        <FormSuccess>{success}</FormSuccess>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading} id="submit-repo-submit">
            {loading ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── review modal (core_head+) ────────────────────────────────────────────

function ReviewModal({ repo, onClose, onSuccess }: { repo: BuilderRepo; onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState<BuilderRepoStatus>(repo.status === "pending" ? "approved" : repo.status);
  const [notes, setNotes] = useState(repo.review_notes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api(`/builders/${repo.id}/review`, {
        method: "PATCH",
        body: { status, review_notes: notes },
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Review failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Review: ${repo.repo_name}`} onClose={onClose}>
      <div style={{ padding: "12px 16px", background: "var(--grey-50)", border: "1px solid var(--grey-100)", borderRadius: 10, marginBottom: 20 }}>
        <a href={repo.repo_url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: "var(--grey-600)", wordBreak: "break-all", display: "block", marginBottom: 6 }}>
          {repo.repo_url}
        </a>
        <p style={{ fontSize: 13, color: "var(--grey-500)", lineHeight: 1.5, margin: 0 }}>{repo.description}</p>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-400)", marginTop: 8, letterSpacing: "0.05em" }}>
          by {repo.submitter_name} · {repo.category}
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <Field label="Decision">
          <div style={{ display: "flex", gap: 10 }}>
            {(["approved", "rejected"] as BuilderRepoStatus[]).map((s) => (
              <label key={s} style={{
                display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                padding: "8px 18px", borderRadius: 100, border: "1.5px solid",
                borderColor: status === s
                  ? (s === "approved" ? "rgba(30,126,52,0.6)" : "rgba(192,57,43,0.6)")
                  : "var(--grey-200)",
                background: status === s
                  ? (s === "approved" ? "rgba(30,126,52,0.06)" : "rgba(192,57,43,0.06)")
                  : "transparent",
                color: status === s
                  ? (s === "approved" ? "#1e7e34" : "#c0392b")
                  : "var(--grey-500)",
                fontWeight: 600, fontSize: 13,
                transition: "all 0.15s",
              }}>
                <input type="radio" value={s} checked={status === s}
                  onChange={() => setStatus(s)} style={{ display: "none" }} id={`review-status-${s}`} />
                {s === "approved" ? "✓ Approve" : "✗ Reject"}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Review notes" hint="Optional — feedback visible to the submitter">
          <textarea
            className="input textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Great project! Needs a README though..."
            id="review-notes"
          />
        </Field>
        <FormError>{error}</FormError>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading} id="review-submit-btn">
            {loading ? "Saving…" : "Save review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── github icon ──────────────────────────────────────────────────────────

function GithubIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04C5.672 21.4 4.968 19.1 4.968 19.1c-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.838 1.237 1.838 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.42-1.305.762-1.605C7.145 17.16 4.343 16.16 4.343 11.5c0-1.31.468-2.38 1.235-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.51 11.51 0 0 1 12 5.803a11.52 11.52 0 0 1 3.006.404c2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.768.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.625-5.479 5.921.43.372.814 1.102.814 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.824.576C20.565 21.796 24 17.298 24 12c0-6.63-5.373-12-12-12z" />
    </svg>
  );
}
