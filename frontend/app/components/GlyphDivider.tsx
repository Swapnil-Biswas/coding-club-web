"use client";

interface GlyphDividerProps {
  label?: string;
  variant?: "default" | "compact";
}

// Nothing Phone-inspired glyph strip: sequence of LED-style dots in different rhythms
export default function GlyphDivider({
  label,
  variant = "default",
}: GlyphDividerProps) {
  return (
    <div className={`glyph-divider ${variant === "compact" ? "glyph-divider-compact" : ""}`}>
      <div className="glyph-row">
        <span className="glyph-dot glyph-long" />
        <span className="glyph-dot" />
        <span className="glyph-dot" />
        <span className="glyph-dot glyph-tiny" />
        <span className="glyph-dot" />
        {label && <span className="glyph-label">{label}</span>}
        <span className="glyph-dot" />
        <span className="glyph-dot glyph-tiny" />
        <span className="glyph-dot" />
        <span className="glyph-dot" />
        <span className="glyph-dot glyph-long" />
      </div>
    </div>
  );
}
