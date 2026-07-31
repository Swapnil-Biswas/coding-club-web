"use client";

import RevealOnScroll from "./RevealOnScroll";

const domains = [
  { code: "WEB", icon: "◆", label: "Web Development", blurb: "TypeScript, React, Next.js, Edge." },
  { code: "APP", icon: "▣", label: "App Development", blurb: "iOS, Android, React Native, Flutter." },
  { code: "AI", icon: "◇", label: "AI / ML", blurb: "PyTorch, on-device LLMs, agents." },
  { code: "SEC", icon: "◈", label: "Cybersecurity", blurb: "CTFs, reverse engineering, web sec." },
  { code: "OSS", icon: "◉", label: "Open Source", blurb: "Maintain, contribute, mentor." },
  { code: "DSN", icon: "▤", label: "Design & Type", blurb: "Product, motion, type systems." },
];

export default function Domains() {
  return (
    <section className="domains" id="domains">
      <div className="domains-inner">
        <RevealOnScroll className="domains-header">
          <span className="section-eyebrow">// 06 — Where we play</span>
          <h2 className="section-heading domains-heading">
            Six domains. <span className="domains-heading-ghost">One club.</span>
          </h2>
        </RevealOnScroll>
        <div className="domains-grid">
          {domains.map((d, i) => (
            <RevealOnScroll key={d.label} delay={i * 70}>
              <div className="domain-chip" id={`domain-${d.code.toLowerCase()}`}>
                <span className="domain-chip-glyph" aria-hidden="true">{d.icon}</span>
                <div className="domain-chip-body">
                  <span className="domain-chip-label">{d.label}</span>
                  <span className="domain-chip-blurb">{d.blurb}</span>
                </div>
                <span className="domain-chip-code">{d.code}</span>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
