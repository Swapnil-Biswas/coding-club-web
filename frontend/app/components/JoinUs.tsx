"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/app/lib/api";
import RevealOnScroll from "./RevealOnScroll";
import GlyphDivider from "./GlyphDivider";
import { FormError, FormSuccess } from "./app/ui";

// 4×6 grid of glyph dots that reacts to mouse — Nothing-style notification strip
function JoinGlyphGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let w = 0, h = 0;
    let animId = 0;

    const COLS = 18;
    const ROWS = 6;
    const dots: { x: number; y: number; phase: number }[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        dots.push({ x: 0, y: 0, phase: Math.random() * Math.PI * 2 });
      }
    }

    const mouse = { x: -1000, y: -1000, active: false };
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const handleLeave = () => { mouse.active = false; };
    const handleResize = () => resize();

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cellW = w / COLS;
      const cellH = h / ROWS;
      let i = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          dots[i].x = c * cellW + cellW / 2;
          dots[i].y = r * cellH + cellH / 2;
          i++;
        }
      }
    }

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", handleLeave);
    window.addEventListener("resize", handleResize);
    resize();

    const start = performance.now();
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const t = (performance.now() - start) / 1000;
      for (const d of dots) {
        let radius = 2.2;
        let opacity = 0.08;
        const wave = Math.sin(t * 1.2 + d.x * 0.02 + d.phase) * 0.5 + 0.5;
        opacity = 0.06 + wave * 0.18;
        radius = 1.6 + wave * 1.6;
        if (mouse.active) {
          const dx = d.x - mouse.x;
          const dy = d.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const force = 1 - dist / 110;
            radius += force * 4;
            opacity = Math.min(0.9, opacity + force * 0.7);
          }
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(29, 29, 31, ${opacity})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="join-glyph-canvas" />;
}

export default function JoinUs() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/join-requests", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), message: message.trim() },
      });
      setDone(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="join" id="join">
      <div className="join-glyph-bg" aria-hidden="true">
        <JoinGlyphGrid />
      </div>
      <div className="join-inner">
        <RevealOnScroll className="join-content">
          <GlyphDivider label="RECRUITING 2026" />
          <h2 className="join-heading">
            We&apos;re opening
            <br />
            the doors. <span className="join-heading-ghost">Again.</span>
          </h2>
          <p className="join-body">
            No interviews. No résumés. Tell us a little about yourself and what
            you&apos;d love to build — the core team will reach out.
          </p>

          <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "left" }}>
            {done ? (
              <div className="card" style={{ textAlign: "center", padding: "44px 30px" }}>
                <div className="empty-glyph" aria-hidden="true"><span /><span /><span /><span /><span /></div>
                <h3 className="card-title" style={{ fontSize: 24, marginBottom: 8 }}>Request received.</h3>
                <p className="card-muted">
                  Thanks, {name || "friend"} — the core team reviews every request and will reach out
                  to <strong>{email}</strong> soon. In the meantime, come say hi at a Tuesday session.
                </p>
                <button className="btn-secondary btn-sm" style={{ marginTop: 22 }} onClick={() => setDone(false)}>
                  Send another request
                </button>
              </div>
            ) : (
              <form className="card" onSubmit={onSubmit} style={{ padding: "30px" }}>
                <FormError>{error}</FormError>
                <FormSuccess>{""}</FormSuccess>
                <div className="form-row">
                  <div className="field">
                    <label className="field-label">Name <span className="req">*</span></label>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Email <span className="req">*</span></label>
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@bmsit.in"
                      required
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">What do you want to build or learn? <span className="req">*</span></label>
                  <textarea
                    className="textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about yourself, your interests, and why you want to join…"
                    required
                  />
                </div>
                <button className="btn-primary btn-block" type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Request to join"}
                </button>
                <p className="form-note" style={{ textAlign: "center", marginTop: 12 }}>
                  This sends a request to the core team — it doesn&apos;t create an account.
                </p>
              </form>
            )}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
