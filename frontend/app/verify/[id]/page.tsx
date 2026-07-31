"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, assetUrl } from "@/app/lib/api";
import type { Certificate } from "@/app/lib/types";
import { Spinner, EmptyState, Badge } from "@/app/components/app/ui";
import { formatDate, certTypeLabel } from "@/app/lib/format";
import QrImage from "@/app/components/app/QrImage";

export default function VerifyCertificatePage() {
  const params = useParams();
  const id = String(params.id || "");
  return <Verify key={id} id={id} />;
}

function Verify({ id }: { id: string }) {
  const [cert, setCert] = useState<Certificate | null>(null);
  const [state, setState] = useState<"loading" | "found" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ certificate: Certificate }>(`/verify/${encodeURIComponent(id)}`);
        if (!cancelled) {
          setCert(data.certificate);
          setState("found");
        }
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="page">
      <div className="section-inner section-inner-sm">
        {state === "loading" && <Spinner label="Verifying" />}

        {state === "missing" && (
          <EmptyState
            title="Certificate not found"
            body="This verification ID doesn't match any certificate we've issued. Check the ID and try again."
            action={<Link href="/verify" className="btn-secondary btn-sm">Try another ID</Link>}
          />
        )}

        {state === "found" && cert && (
          <div>
            <span className="section-eyebrow">// Verified</span>
            <div className="split split-start">
              <h1 className="page-title" style={{ fontSize: 36 }}>
                This certificate is <span className="ghost">genuine.</span>
              </h1>
              <Badge variant="published" dot>Verified</Badge>
            </div>

            <div className="card" style={{ marginTop: 28, padding: 32 }}>
              <div className="certificate-mark" style={{ textAlign: "center", marginBottom: 26 }}>
                <div className="empty-glyph" aria-hidden="true"><span /><span /><span /><span /><span /></div>
                <div className="section-eyebrow" style={{ marginBottom: 6 }}>Certificate of {certTypeLabel(cert.certificate_type)}</div>
                <div className="page-title" style={{ fontSize: 30 }}>{cert.recipient_name}</div>
              </div>

              <div className="detail-meta" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Event</div>
                  <div className="detail-meta-value">{cert.event_title}</div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Date</div>
                  <div className="detail-meta-value">{formatDate(cert.event_date || cert.generated_at)}</div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Type</div>
                  <div className="detail-meta-value">{certTypeLabel(cert.certificate_type)}</div>
                </div>
                <div className="detail-meta-item">
                  <div className="detail-meta-label">Issued by</div>
                  <div className="detail-meta-value">{cert.generated_by_name || "Coding Club BMSIT"}</div>
                </div>
              </div>

              {cert.team_name && (
                <p className="text-mono text-sm text-muted" style={{ textAlign: "center", marginBottom: 18 }}>
                  Team: {cert.team_name}
                </p>
              )}

              <div className="qr-box" style={{ marginTop: 10 }}>
                <QrImage value={cert.verification_id} size={150} />
                <div className="text-mono text-sm text-muted" style={{ textAlign: "center", wordBreak: "break-all" }}>
                  Verification ID
                  <br />
                  <strong style={{ color: "var(--grey-800)" }}>{cert.verification_id}</strong>
                </div>
              </div>

              {cert.pdf_url && (
                <div style={{ textAlign: "center", marginTop: 22 }}>
                  <a className="btn-secondary btn-sm" href={assetUrl(cert.pdf_url) || "#"} target="_blank" rel="noopener noreferrer">
                    Download PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
