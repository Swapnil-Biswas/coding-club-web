"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRecruitment, useShouldShowAnnouncement } from "@/app/lib/recruitment";

export default function RecruitmentBanner() {
  const { state } = useRecruitment();
  const { shouldShow, dismiss } = useShouldShowAnnouncement(state);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Trap focus when showing; restore on dismiss
  useEffect(() => {
    if (shouldShow) closeRef.current?.focus();
  }, [shouldShow]);

  // Reduced motion: skip animation class
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  if (!shouldShow || !state) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`recruitment-banner ${prefersReducedMotion ? "" : "recruitment-banner--animate"}`}
      id="recruitment-banner"
    >
      <div className="recruitment-banner__inner">
        {/* Glow dot */}
        <span className="recruitment-banner__dot" aria-hidden="true" />

        <span className="recruitment-banner__text">
          <strong>{state.title}</strong> is now open!
          {" "}Students in all branches and years are welcome to apply.
        </span>

        <Link
          href="/recruitment"
          className="recruitment-banner__cta"
          onClick={dismiss}
          id="recruitment-banner-apply"
        >
          Apply Now
        </Link>

        <button
          ref={closeRef}
          className="recruitment-banner__close"
          onClick={dismiss}
          aria-label="Dismiss recruitment announcement"
          id="recruitment-banner-dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
