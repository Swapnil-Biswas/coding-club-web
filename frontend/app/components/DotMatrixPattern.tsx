"use client";

import { useEffect, useRef } from "react";

interface Point3D {
  x: number;
  y: number;
  z: number;
  char: string;
}

export default function DotMatrixPattern() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let width = container.clientWidth || 500;
    let height = container.clientHeight || 500;
    const gap = 20;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Baseline grid base radius
    const baseRadius = 2.8;

    // Generate 3D points on a sphere (Fibonacci sphere distribution)
    const points: Point3D[] = [];
    const numPoints = 150;
    const codingChars = [
      "{", "}", "<", ">", "/", ";", "1", "0", "0", "1", 
      "f", "n", "(", ")", "[", "]", "+", "=", "!", "&", "|", ";"
    ];

    for (let i = 0; i < numPoints; i++) {
      const lat = Math.acos(1 - 2 * (i + 0.5) / numPoints);
      const lon = Math.PI * (1 + Math.sqrt(5)) * i; // Golden angle
      points.push({
        x: Math.sin(lat) * Math.cos(lon),
        y: Math.sin(lat) * Math.sin(lon),
        z: Math.cos(lat),
        char: codingChars[i % codingChars.length]
      });
    }

    // Rotation angles and physical states
    let rx = 0.5;
    let ry = 0.5;
    let targetRx = 0.5;
    let targetRy = 0.5;
    let dragRx = 0.5;
    let dragRy = 0.5;
    let isDragging = false;

    // Track mouse position relative to canvas (active over the whole section)
    const mouse = { x: -1000, y: -1000, active: false, startX: 0, startY: 0 };

    const heroSection = (canvas.closest("#hero") || container) as HTMLElement;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (isDragging) {
        const dx = mx - mouse.startX;
        const dy = my - mouse.startY;
        targetRy = dragRy + dx * 0.005;
        targetRx = dragRx - dy * 0.005;
      } else {
        mouse.x = mx;
        mouse.y = my;
        mouse.active = true;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Don't drag if user clicked an interactive UI element like a link or a button
      if (e.target instanceof HTMLElement && (
        e.target.closest("a") || 
        e.target.closest("button") || 
        e.target.closest("input")
      )) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      mouse.startX = e.clientX - rect.left;
      mouse.startY = e.clientY - rect.top;
      dragRx = targetRx;
      dragRy = targetRy;
      isDragging = true;
      heroSection.style.cursor = "grabbing";
    };

    const handleMouseUp = () => {
      isDragging = false;
      heroSection.style.cursor = "default";
    };

    const handleMouseLeave = () => {
      isDragging = false;
      mouse.active = false;
      heroSection.style.cursor = "default";
    };

    const handleResize = () => {
      if (!canvas || !container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    };

    heroSection.addEventListener("mousemove", handleMouseMove);
    heroSection.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    heroSection.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);

    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / gap);
      const rows = Math.ceil(height / gap);
      const sphereScale = Math.min(width, height) * 0.38;

      const focalX = width * 0.15;
      const focalY = height * 0.15;
      const maxDist = Math.sqrt(width * width + height * height) * 0.55;

      // Interpolate rotation angles for high-fidelity smoothness
      rx += (targetRx - rx) * 0.08;
      ry += (targetRy - ry) * 0.08;

      // Slow auto-spin when not dragging
      if (!isDragging) {
        targetRy += 0.003;
        targetRx += 0.0015;
      }

      // Initialize the projection map for grid snapping
      interface GridCellState {
        char: string;
        z: number;
        opacity: number;
      }
      const gridMap: Record<string, GridCellState> = {};

      for (const p of points) {
        // Rotate 3D coordinates using current rx and ry
        // Rotate around Y-axis
        const x1 = p.x * Math.cos(ry) - p.z * Math.sin(ry);
        const z1 = p.x * Math.sin(ry) + p.z * Math.cos(ry);

        // Rotate around X-axis
        const y2 = p.y * Math.cos(rx) - z1 * Math.sin(rx);
        const z2 = p.y * Math.sin(rx) + z1 * Math.cos(rx);

        // Project onto 2D screen coordinates
        const sx = width / 2 + x1 * sphereScale;
        const sy = height / 2 + y2 * sphereScale;

        // Snapping index to grid
        const c = Math.round((sx - gap / 2) / gap);
        const r = Math.round((sy - gap / 2) / gap);

        if (c >= 0 && c < cols && r >= 0 && r < rows) {
          const key = `${c},${r}`;
          // Closer points (larger z2) override further points
          if (!gridMap[key] || z2 > gridMap[key].z) {
            const opacity = 0.2 + ((z2 + 1) / 2) * 0.8;
            gridMap[key] = {
              char: p.char,
              z: z2,
              opacity: opacity,
            };
          }
        }
      }

      // Interaction variables
      const mouseRadius = 85;
      const maxDisplacement = 14;

      // Draw the grid of dots
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * gap + gap / 2;
          const y = r * gap + gap / 2;

          // Calculate focal distance and baseline falloff opacity (quadratic)
          const distToFocal = Math.sqrt((x - focalX) ** 2 + (y - focalY) ** 2);
          const normalizedDist = distToFocal / maxDist;
          let baseOpacity = Math.max(0, 1 - normalizedDist * 1.15);
          baseOpacity = baseOpacity * baseOpacity; // high contrast falloff

          if (baseOpacity < 0.01) continue;

          // Handle interactive mouse magnetic displacement field
          let px = x;
          let py = y;
          let distToMouse = 9999;
          let isNearMouse = false;

          if (mouse.active) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            distToMouse = Math.sqrt(dx * dx + dy * dy);

            if (distToMouse < mouseRadius && distToMouse > 0) {
              isNearMouse = true;
              const force = (mouseRadius - distToMouse) / mouseRadius;
              const push = force * maxDisplacement;
              px += (dx / distToMouse) * push;
              py += (dy / distToMouse) * push;
            }
          }

          const key = `${c},${r}`;
          const activeCell = gridMap[key];

          if (activeCell) {
            // Render 3D sphere projected character in high-fidelity dot matrix style
            const finalOpacity = baseOpacity * activeCell.opacity * 0.95;
            // Larger font size for closer characters (z > 0)
            const fontSize = Math.max(10, Math.round(11 + activeCell.z * 4.5));

            ctx.font = `${activeCell.z > 0.3 ? "700" : "500"} ${fontSize}px var(--font-mono)`;
            ctx.fillStyle = `rgba(29, 29, 31, ${finalOpacity})`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(activeCell.char, px, py);
          } else if (isNearMouse) {
            // Reveal binary coding noise ("0" or "1") within the mouse distortion bubble
            const hoverStrength = (mouseRadius - distToMouse) / mouseRadius;
            const finalOpacity = baseOpacity * hoverStrength * 0.75;
            const binChar = (c + r + Math.floor(Date.now() / 250)) % 2 === 0 ? "0" : "1";

            ctx.font = `600 10px var(--font-mono)`;
            ctx.fillStyle = `rgba(29, 29, 31, ${finalOpacity})`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(binChar, px, py);
          } else {
            // Render standard dot matrix background dots
            const finalOpacity = baseOpacity * 0.15;
            ctx.beginPath();
            ctx.arc(px, py, baseRadius * (0.35 + baseOpacity * 0.65), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(29, 29, 31, ${finalOpacity})`;
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      heroSection.removeEventListener("mousemove", handleMouseMove);
      heroSection.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      heroSection.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", userSelect: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
