"use client";

import { useEffect, useRef } from "react";

interface DotMatrixCanvasProps {
  text: string;
  fontSize?: number;
  dotRadius?: number;
  dotGap?: number;
  color?: string;
  animate?: boolean;
  animDelay?: number;
  style?: React.CSSProperties;
}

// 5x7 Dot Matrix Font Dictionary
const FONT_5X7: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x1f, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x0a, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x02, 0x04, 0x04, 0x08, 0x10, 0x1f],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c], // 2x2 block
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
};

export default function DotMatrixCanvas({
  text,
  fontSize = 100,
  dotRadius,
  dotGap,
  color = "#1d1d1f",
  animate = false,
  animDelay = 0,
  style,
}: DotMatrixCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Calculate gap and radius dynamically based on fontSize if not explicitly provided
    const gap = dotGap || Math.max(4, fontSize / 7.5);
    const radius = dotRadius || gap * 0.28;

    const charWidth = 5;
    const charHeight = 7;
    const charSpacing = 0.5; // 0.5 empty dot column between letters

    const upperText = text.toUpperCase();
    const len = upperText.length;

    // Build the dot position list using variable-width characters (trimming empty outer columns)
    interface InteractiveDot {
      ox: number; // original x
      oy: number; // original y
      x: number;  // current x
      y: number;  // current y
      col: number;
    }
    const dots: InteractiveDot[] = [];
    const padDots = 2;
    let currentCol = padDots;

    for (let charIdx = 0; charIdx < len; charIdx++) {
      const char = upperText[charIdx];
      const charMatrix = FONT_5X7[char] || FONT_5X7[" "];

      // Find bounds of the active columns to make it proportional spacing
      let minCol = 4;
      let maxCol = 0;
      let hasDots = false;

      for (let r = 0; r < charHeight; r++) {
        const rowVal = charMatrix[r];
        for (let c = 0; c < charWidth; c++) {
          if ((rowVal & (1 << (4 - c))) !== 0) {
            if (c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
            hasDots = true;
          }
        }
      }

      // Spaces or unknown characters default to a width of 3 dots
      const actualMinCol = hasDots ? minCol : 0;
      const actualMaxCol = hasDots ? maxCol : 2;
      const activeWidth = actualMaxCol - actualMinCol + 1;

      if (hasDots) {
        for (let r = 0; r < charHeight; r++) {
          const rowVal = charMatrix[r];
          for (let c = actualMinCol; c <= actualMaxCol; c++) {
            if ((rowVal & (1 << (4 - c))) !== 0) {
              const dx = (currentCol + (c - actualMinCol) + 0.5) * gap;
              const dy = (padDots + r + 0.5) * gap;
              dots.push({
                ox: dx,
                oy: dy,
                x: dx,
                y: dy,
                col: currentCol + (c - actualMinCol),
              });
            }
          }
        }
      }

      currentCol += activeWidth + charSpacing;
    }

    const totalCols = currentCol - charSpacing + padDots;
    const w = totalCols * gap;
    const h = (charHeight + padDots * 2) * gap;

    const availableWidth = canvas.parentElement?.clientWidth ?? w;
    const displayScale = window.innerWidth <= 768 ? Math.min(1, availableWidth / w) : 1;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w * displayScale}px`;
    canvas.style.height = `${h * displayScale}px`;
    ctx.scale(dpr, dpr);

    if (dots.length === 0) return;

    // Track mouse position relative to canvas
    const mouse = { x: -1000, y: -1000, active: false };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) * (w / rect.width);
      mouse.y = (e.clientY - rect.top) * (h / rect.height);
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    // Interactive mouse distortion settings
    const hoverRadius = 55; // Pixels of influence
    const maxDisplacement = 20; // Maximum push distance
    const easeSpeed = 0.12; // Spring easing speed

    const startTime = performance.now() + animDelay;
    let animId: number;

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const elapsed = now - startTime;

      for (const d of dots) {
        let targetX = d.ox;
        let targetY = d.oy;

        if (mouse.active) {
          const dx = d.ox - mouse.x;
          const dy = d.oy - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < hoverRadius && dist > 0) {
            const force = (hoverRadius - dist) / hoverRadius;
            const push = force * maxDisplacement;
            targetX = d.ox + (dx / dist) * push;
            targetY = d.oy + (dy / dist) * push;
          }
        }

        // Smooth spring physics (interpolation)
        d.x += (targetX - d.x) * easeSpeed;
        d.y += (targetY - d.y) * easeSpeed;

        const dotDelay = d.col * 12;
        if (animate && elapsed < dotDelay) {
          continue;
        }

        const opacity = animate ? Math.min(1, (elapsed - dotDelay) / 300) : 1;
        const scale = animate ? 0.5 + opacity * 0.5 : 1;

        ctx.beginPath();
        ctx.arc(d.x, d.y, radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = color.startsWith("rgba")
          ? color
          : `rgba(29, 29, 31, ${opacity})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [text, fontSize, dotRadius, dotGap, color, animate, animDelay]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", cursor: "pointer", ...style }}
      aria-label={text}
      role="img"
    />
  );
}
