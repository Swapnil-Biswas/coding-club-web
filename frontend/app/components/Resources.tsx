"use client";

import { useState } from "react";
import RevealOnScroll from "./RevealOnScroll";
import GlyphDivider from "./GlyphDivider";

interface Resource {
  title: string;
  kind: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  format: string;
  blurb: string;
  link: string;
  glyph: string;
}

const groups: { tag: string; items: Resource[] }[] = [
  {
    tag: "Get started",
    items: [
      {
        title: "The Missing Semester of Your CS Education",
        kind: "Course",
        level: "Beginner",
        format: "MIT · Video + Notes",
        blurb: "Shell, git, editors, debugging — the stuff no syllabus covers but every job needs.",
        link: "https://missing.csail.mit.edu",
        glyph: "0010",
      },
      {
        title: "CS50x",
        kind: "Course",
        level: "Beginner",
        format: "Harvard · 12 weeks",
        blurb: "The classic. Start here if you've never written a line of code in your life.",
        link: "https://cs50.harvard.edu/x/",
        glyph: "0101",
      },
    ],
  },
  {
    tag: "Web",
    items: [
      {
        title: "web.dev",
        kind: "Reference",
        level: "Intermediate",
        format: "Google · Free",
        blurb: "The web platform, explained by the people who build the browsers. Patterns, performance, a11y.",
        link: "https://web.dev",
        glyph: "1100",
      },
      {
        title: "Patterns.dev",
        kind: "Patterns",
        level: "Intermediate",
        format: "Book · Free online",
        blurb: "Modern web app patterns — render, suspense, islands, signals. By the Lydia & team.",
        link: "https://www.patterns.dev",
        glyph: "1011",
      },
    ],
  },
  {
    tag: "AI / ML",
    items: [
      {
        title: "Andrej Karpathy — Zero to Hero",
        kind: "Course",
        level: "Intermediate",
        format: "Video · ~25h",
        blurb: "Build GPT from scratch. The best neural-net intuition you'll ever get, in one playlist.",
        link: "https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ",
        glyph: "0110",
      },
      {
        title: "Hugging Face NLP Course",
        kind: "Course",
        level: "Advanced",
        format: "Free · Interactive",
        blurb: "Transformers, fine-tuning, RAG, agents. The fastest way to go from 'reads papers' to 'ships models'.",
        link: "https://huggingface.co/learn/nlp-course",
        glyph: "1001",
      },
    ],
  },
  {
    tag: "Systems",
    items: [
      {
        title: "Build Your Own X",
        kind: "Curated",
        level: "Intermediate",
        format: "GitHub · Free",
        blurb: "Redis, Docker, Git, even a database — rebuilt from scratch. The best way to learn how things work.",
        link: "https://github.com/codecrafters-io/build-your-own-x",
        glyph: "1110",
      },
      {
        title: "Operating Systems: Three Easy Pieces",
        kind: "Book",
        level: "Advanced",
        format: "Free PDF",
        blurb: "The OS textbook that actually makes sense. Virtualization, concurrency, file systems, persistence.",
        link: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
        glyph: "0101",
      },
    ],
  },
];

export default function Resources() {
  const [active, setActive] = useState<string>(groups[0].tag);
  const visible = groups.find((g) => g.tag === active) ?? groups[0];

  return (
    <section className="resources" id="resources">
      <div className="resources-inner">
        <RevealOnScroll className="resources-header">
          <span className="section-eyebrow">// 05 — Learn with us</span>
          <h2 className="section-heading">
            Resources we
            <br />
            <span className="resources-heading-ghost">actually used.</span>
          </h2>
          <p className="section-body resources-sub">
            No 200-item link dumps. Just the courses, books, and references the
            core team genuinely learned from. Curated, not aggregated.
          </p>
        </RevealOnScroll>

        <RevealOnScroll delay={100}>
          <div className="resources-tabs" role="tablist">
            {groups.map((g) => (
              <button
                key={g.tag}
                role="tab"
                aria-selected={active === g.tag}
                className={`resources-tab ${active === g.tag ? "is-active" : ""}`}
                onClick={() => setActive(g.tag)}
                id={`resource-tab-${g.tag.toLowerCase().replace(/\s/g, "-")}`}
              >
                {active === g.tag && (
                  <span className="resources-tab-led" aria-hidden="true" />
                )}
                {g.tag}
              </button>
            ))}
          </div>
        </RevealOnScroll>

        <GlyphDivider variant="compact" />

        <div className="resources-list" key={active}>
          {visible.items.map((r, i) => (
            <a
              key={r.title}
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="resource-row"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="resource-glyph" aria-hidden="true">
                <span>{r.glyph}</span>
                <div className="resource-glyph-bars">
                  {r.glyph.split("").map((bit, k) => (
                    <span
                      key={k}
                      className={`resource-glyph-bar ${bit === "1" ? "is-on" : ""}`}
                    />
                  ))}
                </div>
              </div>
              <div className="resource-content">
                <div className="resource-top">
                  <span className="resource-kind">{r.kind}</span>
                  <span className={`resource-level level-${r.level.toLowerCase()}`}>
                    {r.level}
                  </span>
                </div>
                <h3 className="resource-title">{r.title}</h3>
                <p className="resource-blurb">{r.blurb}</p>
                <span className="resource-format">{r.format}</span>
              </div>
              <div className="resource-arrow" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
