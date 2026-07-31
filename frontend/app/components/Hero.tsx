"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import DotMatrixCanvas from "./DotMatrixCanvas";
import DotMatrixPattern from "./DotMatrixPattern";
import Cursor from "./Cursor";

export default function Hero() {
  const [fontSize, setFontSize] = useState(100);
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      if (vw < 480) setFontSize(40);
      else if (vw < 768) setFontSize(56);
      else if (vw < 1024) setFontSize(72);
      else setFontSize(100);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      setTime(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="hero" id="hero">
      <div className="hero-status" aria-hidden="true">
        <div className="hero-status-row">
          <span className="hero-status-led" />
          <span className="hero-status-label">SYSTEM ONLINE</span>
          <span className="hero-status-divider">·</span>
          <span className="hero-status-label">BMSIT / BANGALORE</span>
          <span className="hero-status-divider">·</span>
          <span className="hero-status-label hero-status-time">{time}</span>
        </div>
        <div className="hero-status-row hero-status-row-glyphs">
          <span /><span /><span /><span /><span />
          <span /><span /><span /><span /><span />
          <span /><span /><span /><span /><span />
        </div>
      </div>

      <div className="hero-inner">
        {/* Left: Dot matrix text + tagline + buttons */}
        <div className="hero-left">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            <span>CODING CLUB · EST. 2018</span>
            <Cursor />
          </div>

          <div className="hero-dot-lines">
            <DotMatrixCanvas
              text="CODE."
              fontSize={fontSize}
              animate
              animDelay={200}
            />
            <DotMatrixCanvas
              text="CREATE."
              fontSize={fontSize}
              animate
              animDelay={500}
            />
            <DotMatrixCanvas
              text="COLLABORATE."
              fontSize={fontSize}
              animate
              animDelay={800}
            />
          </div>

          <p className="hero-tagline">
            A community of curious minds building
            <br />
            the future through code.
          </p>

          <div className="hero-actions">
            <Link href="#join" className="btn-primary" id="hero-join-btn">
              JOIN US
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <Link href="#events" className="btn-secondary" id="hero-events-btn">
              EXPLORE EVENTS
            </Link>
          </div>

          <div className="hero-strip" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        {/* Right: Decorative dot pattern */}
        <div className="hero-right">
          <DotMatrixPattern />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero-scroll" aria-hidden="true">
        <span className="hero-scroll-dot">●</span>
        <span className="hero-scroll-text">SCROLL TO DISCOVER</span>
      </div>
    </section>
  );
}
