"use client";

import { useState } from "react";
import Link from "next/link";
import GlyphDivider from "./GlyphDivider";

export default function Footer() {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer className="footer" id="footer">
      <div className="footer-glyph-strip" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
      </div>

      <div className="footer-top">
        {/* Brand */}
        <div className="footer-brand">
          <Link href="/" className="footer-brand-logo">
            <svg
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="40" height="40" rx="10" fill="#1d1d1f" />
              <text
                x="50%"
                y="54%"
                dominantBaseline="middle"
                textAnchor="middle"
                fill="white"
                fontSize="18"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >
                CC
              </text>
            </svg>
            <span className="footer-brand-name">Coding Club</span>
          </Link>
          <span className="footer-brand-tagline">
            Code. Create. Collaborate.
          </span>
          <span className="footer-brand-meta">
            BMSIT &amp; M · Bengaluru, IN
          </span>
        </div>

        {/* Quick Links */}
        <div>
          <p className="footer-col-title">Navigate</p>
          <ul className="footer-col-list">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/events">Events</Link></li>
            <li><Link href="/teams">Team</Link></li>
            <li><Link href="/gallery">Gallery</Link></li>
            <li><Link href="/partners">Partners</Link></li>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/verify">Verify certificate</Link></li>
            <li><Link href="/join">Join us</Link></li>
          </ul>
        </div>

        {/* Domains */}
        <div>
          <p className="footer-col-title">Domains</p>
          <ul className="footer-col-list">
            <li><Link href="/teams">Web Development</Link></li>
            <li><Link href="/teams">App Development</Link></li>
            <li><Link href="/teams">AI / ML</Link></li>
            <li><Link href="/teams">Cybersecurity</Link></li>
            <li><Link href="/teams">Open Source</Link></li>
          </ul>
        </div>

        {/* Connect */}
        <div>
          <p className="footer-col-title">Connect</p>
          <div className="footer-social">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              id="social-instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              id="social-github"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              id="social-twitter"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              id="social-linkedin"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </a>
            <a
              href="mailto:codingclub@bmsit.in"
              aria-label="Email"
              id="social-email"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </a>
          </div>
        </div>

        {/* Newsletter */}
        <div className="footer-newsletter">
          <p className="footer-newsletter-title">Newsletter</p>
          <p className="footer-newsletter-desc">
            One mail a month. Events, opportunities, and the occasional manifesto.
          </p>
          <form
            className="footer-newsletter-form"
            onSubmit={handleSubmit}
          >
            <input
              type="email"
              placeholder="you@domain.com"
              className="footer-newsletter-input"
              id="newsletter-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email for newsletter"
            />
            <button
              type="submit"
              className="footer-newsletter-btn"
              id="newsletter-submit"
            >
              {subscribed ? "✓" : "→"}
            </button>
          </form>
          <span className={`footer-newsletter-status ${subscribed ? "is-on" : ""}`}>
            {subscribed ? "Subscribed — check your inbox." : "No spam, unsubscribe anytime."}
          </span>
        </div>
      </div>

      <GlyphDivider variant="compact" />

      <div className="footer-bottom">
        <p className="footer-copy">
          © {year} Coding Club BMSIT · Made by students, for students.
        </p>
        <p className="footer-build">
          <span>BUILD</span>
          <span className="footer-build-dot" />
          <span>v3.1.0</span>
          <span className="footer-build-dot" />
          <span>STABLE</span>
        </p>
      </div>
    </footer>
  );
}
