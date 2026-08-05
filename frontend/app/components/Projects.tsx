"use client";

import { useEffect, useState } from "react";
import RevealOnScroll from "./RevealOnScroll";
import GlyphDivider from "./GlyphDivider";
import type { Project, ProjectCategory } from "@/app/lib/types";
import { api } from "@/app/lib/api";

const CATEGORIES: { key: ProjectCategory | "all"; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "web",         label: "Web" },
  { key: "ai",          label: "AI / ML" },
  { key: "mobile",      label: "Mobile" },
  { key: "open-source", label: "Open Source" },
  { key: "other",       label: "Other" },
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<ProjectCategory | "all">("all");

  useEffect(() => {
    api<{ projects: Project[] }>("/projects")
      .then((d) => setProjects(d.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === "all"
      ? projects
      : projects.filter((p) => p.category === filter);

  // Hide the section entirely when there are no projects yet
  if (!loading && projects.length === 0) return null;

  return (
    <section className="projects" id="projects">
      <div className="projects-inner">
        <RevealOnScroll className="projects-header">
          <span className="section-eyebrow">// 03 — What we ship</span>
          <h2 className="section-heading">
            Projects, not
            <br />
            <span className="projects-heading-ghost">tutorials.</span>
          </h2>
          <p className="section-body projects-sub">
            Every project below started as a Saturday afternoon and an
            unreasonable amount of coffee. Browse, fork, build on top.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={120}>
          <div className="projects-filters" role="tablist">
            {CATEGORIES.filter((c) =>
              c.key === "all"
                ? true
                : projects.some((p) => p.category === c.key),
            ).map((c) => (
              <button
                key={c.key}
                role="tab"
                aria-selected={filter === c.key}
                className={`projects-filter ${filter === c.key ? "is-active" : ""}`}
                onClick={() => setFilter(c.key)}
                id={`filter-${c.key}`}
              >
                {filter === c.key && <span className="projects-filter-dot" />}
                {c.label}
              </button>
            ))}
          </div>
        </RevealOnScroll>

        <GlyphDivider variant="compact" />

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--grey-400)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--grey-400)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
            No projects in this category yet.
          </div>
        ) : (
          <div className="projects-grid">
            {filtered.map((p, i) => (
              <RevealOnScroll key={p.id} delay={i * 70}>
                <article className="project-card">
                  <div className="project-card-top">
                    <div className="project-dots" aria-hidden="true">
                      <span /><span /><span />
                    </div>
                    <span className={`project-status status-${p.status}`}>
                      {p.status === "shipped"
                        ? "● Shipped"
                        : p.status === "wip"
                        ? "○ In progress"
                        : "◇ Concept"}
                    </span>
                  </div>

                  <h3 className="project-title">{p.title}</h3>
                  <p className="project-desc">{p.description}</p>

                  <div className="project-tags">
                    {p.tags.map((t) => (
                      <span key={t} className="project-tag">{t}</span>
                    ))}
                  </div>

                  <div className="project-foot">
                    <span className="project-author">{p.author_name}</span>
                    <span className="project-year">{p.year}</span>
                  </div>

                  {/* Links */}
                  {(p.github_url || p.live_url) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {p.github_url && (
                        <a
                          href={p.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: "5px 12px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          GitHub ↗
                        </a>
                      )}
                      {p.live_url && (
                        <a
                          href={p.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: "5px 12px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Live ↗
                        </a>
                      )}
                    </div>
                  )}

                  <div className="project-shimmer" aria-hidden="true" />
                </article>
              </RevealOnScroll>
            ))}
          </div>
        )}

        <RevealOnScroll delay={200}>
          <div className="projects-more">
            <a className="btn-secondary" href="#join">
              VIEW ALL ON GITHUB
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
