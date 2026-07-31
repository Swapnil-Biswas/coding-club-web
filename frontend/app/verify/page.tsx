"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/components/app/ui";

export default function VerifyLandingPage() {
  const router = useRouter();
  const [id, setId] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = id.trim();
    if (trimmed) router.push(`/verify/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="page">
      <div className="section-inner section-inner-sm">
        <PageHeader
          eyebrow="// Verify"
          title="Check a"
          ghost="certificate."
          sub="Every certificate the club issues carries a unique verification ID. Paste it here to confirm it's genuine."
        />
        <form onSubmit={onSubmit} className="card" style={{ padding: 30 }}>
          <div className="field">
            <label className="field-label">Verification ID</label>
            <input
              className="input text-mono"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. 3f8a2c1e-…"
              required
            />
          </div>
          <button className="btn-primary btn-block" type="submit">
            Verify certificate
          </button>
          <p className="form-note" style={{ textAlign: "center", marginTop: 12 }}>
            Found on the bottom of the certificate, or in the delivery email.
          </p>
        </form>
      </div>
    </div>
  );
}
