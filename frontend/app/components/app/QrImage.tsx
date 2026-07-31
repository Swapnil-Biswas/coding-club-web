"use client";

import { useEffect, useRef } from "react";

/**
 * Renders a QR code for a value into a canvas. We encode the frontend's
 * check-in URL so a scanned phone camera opens the scanner page pre-filled;
 * scanners can also copy the raw token from below the code.
 */
export default function QrImage({ value, size = 220 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (async () => {
      if (!value || !ref.current) return;
      try {
        const QRCode = (await import("qrcode")).default;
        const url = `${window.location.origin}/checkin?token=${encodeURIComponent(value)}`;
        await QRCode.toCanvas(ref.current, url, {
          width: size * 2,
          margin: 1,
          color: { dark: "#1d1d1f", light: "#ffffff" },
        });
      } catch {
        // If QR generation fails, leave the canvas blank — the token text below
        // still lets a human type it in manually.
      }
    })();
    // No cleanup needed: drawing to the canvas is idempotent for a given value.
  }, [value, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size, borderRadius: 8 }}
      aria-label="QR code for event check-in"
    />
  );
}
