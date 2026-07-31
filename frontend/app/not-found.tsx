import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="section-inner section-inner-sm" style={{ textAlign: "center" }}>
        <div className="empty-glyph" aria-hidden="true" style={{ marginTop: 60 }}>
          <span /><span /><span /><span /><span />
        </div>
        <span className="section-eyebrow">// 404</span>
        <h1 className="page-title" style={{ fontSize: 44, marginTop: 10 }}>
          Lost in the <span className="ghost">void.</span>
        </h1>
        <p className="page-sub" style={{ margin: "16px auto 30px" }}>
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <Link href="/" className="btn-primary">Back to home</Link>
      </div>
    </div>
  );
}
