"use client";

import { useEffect } from "react";
import ArcadeGame from "./ArcadeGame";

interface ArcadeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArcadeModal({ isOpen, onClose }: ArcadeModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          background: "linear-gradient(180deg, rgba(22, 22, 30, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "14px",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.2)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "arcadePopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes arcadePopIn {
            0% { transform: scale(0.92); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {/* Arcade Window Header */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(40, 40, 50, 0.9) 0%, rgba(25, 25, 35, 0.9) 100%)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            userSelect: "none",
          }}
        >
          {/* Traffic Lights */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              onClick={onClose}
              title="Close Arcade (ESC)"
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#ff5f56",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "8px",
                fontWeight: 900,
                color: "rgba(0,0,0,0.6)",
              }}
            >
              ✕
            </div>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ffbd2e", opacity: 0.8 }} />
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#27c93f", opacity: 0.8 }} />
          </div>

          {/* Centered Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#38bdf8",
              fontFamily: '"SF Mono", "Fira Code", monospace',
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            <span>[ RETRO ARCADE // CYBER INVADERS ]</span>
          </div>

          {/* Close button pill */}
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#94a3b8",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            ESC
          </button>
        </div>

        {/* Arcade Body */}
        <div style={{ padding: "16px", background: "#0a0a0f" }}>
          <ArcadeGame />
        </div>
      </div>
    </div>
  );
}
