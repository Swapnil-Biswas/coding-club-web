import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — BMSIT Coding Club",
  description:
    "Terms & Conditions governing your access to and use of BMSIT Coding Club website (bmsitcodingclub.space) and its club facilities.",
};

export default function TermsPage() {
  return (
    <div className="page">
      <div className="section-inner section-inner-sm" style={{ maxWidth: 840, padding: "80px 24px" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--grey-500)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Back to home
          </Link>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: 40, borderBottom: "1px solid var(--grey-200)", paddingBottom: 28 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--grey-400)",
              display: "block",
              marginBottom: 10,
            }}
          >
            // Legal documentation
          </span>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--grey-900)",
              marginBottom: 10,
            }}
          >
            Terms &amp; Conditions
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--grey-500)",
              letterSpacing: "0.06em",
            }}
          >
            BMSIT Coding Club · Last updated: 17 October 2026
          </p>
        </div>

        {/* Terms Body */}
        <div
          className="legal-article"
          style={{
            color: "var(--grey-700)",
            fontSize: 15,
            lineHeight: 1.8,
            fontFamily: "var(--font-body)",
          }}
        >
          <p style={{ marginBottom: 18 }}>
            These Terms &amp; Conditions (“Terms”) govern your access to and use of{" "}
            <a href="https://bmsitcodingclub.space" style={{ color: "var(--grey-900)", textDecoration: "underline" }}>
              https://bmsitcodingclub.space
            </a>{" "}
            (the “Website”), operated by BMSIT Coding Club (“the Club”, “we”, “us” or “our”). The Website provides online facilities related to the Club and its activities.
          </p>
          <p style={{ marginBottom: 32, padding: "14px 18px", background: "var(--grey-50)", borderRadius: 10, border: "1px solid var(--grey-200)", fontSize: 14 }}>
            By accessing or using the Website, you agree to these Terms to the extent permitted by applicable law. If you do not agree, please discontinue use of the Website. For questions about these Terms, contact{" "}
            <a href="mailto:codingclub@bmsit.in" style={{ color: "var(--grey-900)", fontWeight: 600 }}>
              codingclub@bmsit.in
            </a>
            .
          </p>

          {/* 1. Purpose of the Website */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              1. Purpose of the Website
            </h2>
            <p>
              The Website may provide information about the Club and its activities, user accounts and Google Sign-In, recruitment applications, event registration and administration, attendance management, certificate generation or verification, and other club-related services. Features may change as the Website develops.
            </p>
          </section>

          {/* 2. Eligibility and Accounts */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              2. Eligibility and Accounts
            </h2>
            <p style={{ marginBottom: 12 }}>
              You must provide accurate information when using forms or creating an account. You must not knowingly impersonate another person or misrepresent your identity. Where a feature requires an account, you are responsible for using an account you are authorised to access and for promptly reporting suspected unauthorised access.
            </p>
            <p style={{ marginBottom: 12 }}>
              The Website currently assigns roles according to email-domain rules: accounts using an @bmsit.in email address are assigned the member role, while accounts using an @gmail.com email address are assigned the public role. These rules control Website access and do not independently verify identity, student status, staff status, membership or eligibility for a specific activity. Additional eligibility checks may apply where announced.
            </p>
            <p>
              We may restrict access to features where reasonably necessary to maintain security, administer the Website or enforce these Terms.
            </p>
          </section>

          {/* 3. Google Sign-In */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              3. Google Sign-In
            </h2>
            <p>
              The Website may allow you to authenticate through Google Sign-In. You must use a Google account that you are authorised to access. You must not manipulate authentication responses, impersonate another user or bypass Website access controls. Google Sign-In authenticates your account; it does not guarantee Club membership, recruitment eligibility, event entry, an award or a certificate. Your use of Google Sign-In is also subject to Google&apos;s applicable terms and policies.
            </p>
          </section>

          {/* 4. Acceptable Use */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              4. Acceptable Use
            </h2>
            <p style={{ marginBottom: 12 }}>When using the Website, you must not:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>submit false, misleading, fraudulent or impersonated information;</li>
              <li>access accounts, records, administrative functions or systems without authorisation;</li>
              <li>attempt to bypass authentication, role restrictions, application limits or security controls;</li>
              <li>interfere with the Website&apos;s availability, integrity or normal operation;</li>
              <li>introduce malicious software, scripts or other harmful content;</li>
              <li>scrape, extract, publish or misuse personal information without authorisation;</li>
              <li>forge certificates, attendance records, application details or other official-looking records; or</li>
              <li>use the Website in a way that violates applicable law or infringes another person&apos;s rights.</li>
            </ul>
            <p>We may investigate suspected misuse and take proportionate action where appropriate.</p>
          </section>

          {/* 5. Recruitment Applications */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              5. Recruitment Applications
            </h2>
            <p style={{ marginBottom: 12 }}>
              Recruitment applications are governed by the instructions, eligibility criteria, deadlines and requirements published for the relevant recruitment cycle. Where the two-team application limit is enabled, each applicant may apply to no more than two teams for that cycle. The Website may enforce this limit through its application system.
            </p>
            <p>
              Applicants must submit accurate information and must not use duplicate or misleading identities to circumvent application limits. Submitting an application does not guarantee shortlisting, selection, an interview, membership or any other outcome. Decisions are made according to the criteria and process applicable to the relevant cycle. We may correct administrative errors, investigate suspected misuse or request clarification where reasonably necessary.
            </p>
          </section>

          {/* 6. Events, Attendance and Certificates */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              6. Events, Attendance and Certificates
            </h2>
            <p style={{ marginBottom: 12 }}>
              Event participation may be subject to separate announcements, eligibility criteria, registration deadlines, capacity limits and instructions issued by organisers. Registration does not guarantee entry where capacity is limited or additional eligibility requirements apply.
            </p>
            <p>
              Attendance records may be used to administer events and determine participation or certificate eligibility. Certificates may be issued only where the applicable requirements are satisfied. You must not falsify attendance, alter certificates without authorisation, misrepresent participation or claim an award or credential that was not issued to you. If an attendance record or certificate appears incorrect, contact{" "}
              <a href="mailto:codingclub@bmsit.in" style={{ color: "var(--grey-900)" }}>
                codingclub@bmsit.in
              </a>{" "}
              with relevant details.
            </p>
          </section>

          {/* 7. Website Content and Intellectual Property */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              7. Website Content and Intellectual Property
            </h2>
            <p>
              Unless otherwise indicated, Website content—including original text, design, graphics, software, branding and other materials—is owned by or used with permission by the relevant rights holders. You may access and use the Website for lawful personal, educational and club-related purposes. You must not reproduce, modify, redistribute, commercially exploit or represent Website content as your own where doing so is unauthorised or infringes applicable rights. Third-party names, logos, software and materials remain the property of their respective owners.
            </p>
          </section>

          {/* 8. User Submissions */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              8. User Submissions
            </h2>
            <p style={{ marginBottom: 12 }}>
              You are responsible for the information and materials you submit through the Website and must have the rights and permissions necessary to submit them. Do not submit another person&apos;s confidential or personal information without appropriate authorisation.
            </p>
            <p>
              You authorise the Club to use submitted information to the extent reasonably necessary to process your application, administer events, manage attendance, issue certificates and operate the relevant Website feature, subject to the Privacy Policy and applicable requirements. Submitting original work does not, by itself, transfer its ownership to the Club. Separate event, competition or project rules may apply where they are clearly communicated to participants.
            </p>
          </section>

          {/* 9. Privacy */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              9. Privacy
            </h2>
            <p>
              Your use of the Website is also governed by our{" "}
              <Link href="/privacy" style={{ color: "var(--grey-900)", textDecoration: "underline" }}>
                Privacy Policy
              </Link>
              , which explains how personal information is handled in connection with Google Sign-In, accounts, recruitment, events, attendance, certificates and related features. Please review it before submitting personal information.
            </p>
          </section>

          {/* 10. Website Availability and Changes */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              10. Website Availability and Changes
            </h2>
            <p>
              We aim to maintain a useful and reliable Website but do not guarantee uninterrupted availability, error-free operation or permanent availability of every feature. We may update, suspend, replace or discontinue features for maintenance, security, operational, administrative or other legitimate reasons. Where reasonably practicable, we will take appropriate steps to minimise disruption, but we cannot guarantee advance notice of every change or interruption.
            </p>
          </section>

          {/* 11. Account Restrictions and Termination */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              11. Account Restrictions and Termination
            </h2>
            <p>
              We may restrict, suspend or terminate access to an account or feature where reasonably necessary to address suspected misuse, unauthorised access, security risks, violations of these Terms or legitimate operational requirements. Where appropriate and practicable, we may notify the affected user and provide a way to contact us about the decision. Account restrictions do not remove rights or obligations that apply under law. Personal information associated with an account will be handled under the Privacy Policy and applicable retention requirements.
            </p>
          </section>

          {/* 12. Third-Party Services */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              12. Third-Party Services
            </h2>
            <p>
              The Website may depend on or link to third-party services, including Google authentication and infrastructure providers. Those services may have separate terms, privacy policies, availability conditions and technical limitations. We do not control every aspect of third-party services and cannot guarantee their continued availability or operation.
            </p>
          </section>

          {/* 13. Disclaimers */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              13. Disclaimers
            </h2>
            <p>
              The Website and its features are provided on an as-available basis, subject to applicable law. We aim to keep information accurate and current, but administrative errors, outdated content, technical issues or interruptions may occur. Nothing in these Terms excludes a right, remedy, guarantee or liability that cannot lawfully be excluded or limited.
            </p>
          </section>

          {/* 14. Limitation of Liability */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              14. Limitation of Liability
            </h2>
            <p>
              To the extent permitted by applicable law, the Club is not responsible for losses arising from matters such as Website interruptions, third-party service failures, unauthorised use or inaccuracies that could not reasonably have been prevented. This clause does not exclude or limit liability where such exclusion or limitation is prohibited by law, and it does not remove statutory rights available to users.
            </p>
          </section>

          {/* 15. Changes to These Terms */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              15. Changes to These Terms
            </h2>
            <p>
              We may revise these Terms when the Website, Club processes or applicable requirements change. Updated Terms will be published on this page with a revised date. Where required, we will provide appropriate notice or obtain agreement before applying material changes. Continued use after an update is subject to applicable law and any consent requirements that apply.
            </p>
          </section>

          {/* 16. Applicable Law and Disputes */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              16. Applicable Law and Disputes
            </h2>
            <p>
              These Terms are intended to be interpreted consistently with the applicable laws of India. If a concern arises, we encourage you to contact the Club first so that it can be reviewed and, where possible, resolved informally. Nothing in this section prevents a person from exercising a right or remedy available under applicable law.
            </p>
          </section>

          {/* 17. Contact */}
          <section style={{ marginBottom: 32, padding: "24px", background: "var(--grey-50)", borderRadius: 12, border: "1px solid var(--grey-200)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              17. Contact
            </h2>
            <p style={{ marginBottom: 4, fontWeight: 600, color: "var(--grey-900)" }}>BMSIT Coding Club</p>
            <p style={{ marginBottom: 4 }}>
              Email:{" "}
              <a href="mailto:codingclub@bmsit.in" style={{ color: "var(--grey-900)", textDecoration: "underline" }}>
                codingclub@bmsit.in
              </a>
            </p>
            <p>
              Website:{" "}
              <a href="https://bmsitcodingclub.space" style={{ color: "var(--grey-900)", textDecoration: "underline" }}>
                https://bmsitcodingclub.space
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
