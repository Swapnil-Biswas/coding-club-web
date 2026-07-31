"use client";

import { useState } from "react";
import RevealOnScroll from "./RevealOnScroll";
import GlyphDivider from "./GlyphDivider";

type Category = "all" | "web" | "ai" | "mobile" | "open-source";

interface Project {
  title: string;
  desc: string;
  tags: string[];
  category: Exclude<Category, "all">;
  author: string;
  year: string;
  status: "shipped" | "wip" | "concept";
}

const projects: Project[] = [
  {
    title: "GlyphOS",
    desc: "A keyboard-first launcher inspired by the Nothing aesthetic. Search apps, run scripts, control your machine — all from a single monochrome prompt.",
    tags: ["Tauri", "Rust", "TypeScript"],
    category: "open-source",
    author: "Anika R.",
    year: "2026",
    status: "shipped",
  },
  {
    title: "Borealis",
    desc: "Real-time focus tracker. Watches your screen, logs your app switches, and shows you a beautiful monochrome timeline of where your day actually went.",
    tags: ["Electron", "SQLite", "D3"],
    category: "web",
    author: "Rohan M.",
    year: "2026",
    status: "shipped",
  },
  {
    title: "Loom.",
    desc: "A note-taking app that treats your ideas like a thread. Drag, drop, link, and watch your second brain weave itself together.",
    tags: ["Next.js", "Edge", "PG"],
    category: "web",
    author: "Diya S.",
    year: "2026",
    status: "wip",
  },
  {
    title: "Pulse",
    desc: "Tiny on-device LLM helper. Summarizes long threads, drafts replies, and never sends a single byte to the cloud.",
    tags: ["PyTorch", "GGUF", "Swift"],
    category: "ai",
    author: "Karthik V.",
    year: "2026",
    status: "wip",
  },
  {
    title: "Hex",
    desc: "A monochrome habit tracker that feels like a piece of industrial design. No streaks, no shame, no neon — just dots and progress.",
    tags: ["React Native", "Reanimated"],
    category: "mobile",
    author: "Maya P.",
    year: "2025",
    status: "shipped",
  },
  {
    title: "argv.",
    desc: "CLI that turns long English sentences into safe shell commands. Powered by a fine-tuned 1B model that runs on your laptop.",
    tags: ["Python", "llama.cpp"],
    category: "ai",
    author: "Arjun N.",
    year: "2025",
    status: "concept",
  },
];

const categories: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "web", label: "Web" },
  { key: "ai", label: "AI / ML" },
  { key: "mobile", label: "Mobile" },
  { key: "open-source", label: "Open Source" },
];

export default function Projects() {
  const [filter, setFilter] = useState<Category>("all");
  const filtered = filter === "all" ? projects : projects.filter((p) => p.category === filter);

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
            Every project below started as a Saturday afternoon and an unreasonable
            amount of coffee. Browse, fork, build on top.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={120}>
          <div className="projects-filters" role="tablist">
            {categories.map((c) => (
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

        <div className="projects-grid">
          {filtered.map((p, i) => (
            <RevealOnScroll key={p.title} delay={i * 70}>
              <article className="project-card">
                <div className="project-card-top">
                  <div className="project-dots" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                  <span className={`project-status status-${p.status}`}>
                    {p.status === "shipped" ? "● Shipped" : p.status === "wip" ? "○ In progress" : "◇ Concept"}
                  </span>
                </div>
                <h3 className="project-title">{p.title}</h3>
                <p className="project-desc">{p.desc}</p>
                <div className="project-tags">
                  {p.tags.map((t) => (
                    <span key={t} className="project-tag">{t}</span>
                  ))}
                </div>
                <div className="project-foot">
                  <span className="project-author">{p.author}</span>
                  <span className="project-year">{p.year}</span>
                </div>
                <div className="project-shimmer" aria-hidden="true" />
              </article>
            </RevealOnScroll>
          ))}
        </div>

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
