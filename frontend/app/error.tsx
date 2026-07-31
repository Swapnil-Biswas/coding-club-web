"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page">
      <div className="section-inner section-inner-sm" style={{ textAlign: "center" }}>
        <span className="section-eyebrow">// Something broke</span>
        <h1 className="page-title" style={{ fontSize: 40, marginTop: 10 }}>
          An <span className="ghost">error.</span>
        </h1>
        <p className="page-sub" style={{ margin: "16px auto 30px" }}>
          {error?.message || "An unexpected error occurred. Please try again."}
        </p>
        <button className="btn-primary" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
