import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — BMSIT Coding Club",
  description:
    "Privacy Policy for BMSIT Coding Club website (bmsitcodingclub.space). Learn how we handle your account data, Google Sign-In, and personal information.",
};

export default function PrivacyPolicyPage() {
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
            Privacy Policy
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

        {/* Legal Body */}
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
            This Privacy Policy explains how BMSIT Coding Club (“the Club”, “we”, “us” or “our”) handles personal information when you visit or use{" "}
            <a href="https://bmsitcodingclub.space" style={{ color: "var(--grey-900)", textDecoration: "underline" }}>
              https://bmsitcodingclub.space
            </a>{" "}
            (the “Website”), sign in, apply for recruitment, register for or participate in activities, or use related features.
          </p>
          <p style={{ marginBottom: 32, padding: "14px 18px", background: "var(--grey-50)", borderRadius: 10, border: "1px solid var(--grey-200)", fontSize: 14 }}>
            For privacy questions or requests, contact{" "}
            <a href="mailto:codingclub@bmsit.in" style={{ color: "var(--grey-900)", fontWeight: 600 }}>
              codingclub@bmsit.in
            </a>
            .
          </p>

          {/* 1. Information We Collect */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              1. Information We Collect
            </h2>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--grey-800)", marginBottom: 8 }}>
                1.1 Google Sign-In and account information
              </h3>
              <p style={{ marginBottom: 12 }}>
                When you choose Google Sign-In, we receive the information made available by the Google authentication process and the permissions configured for the Website. This may include your name, email address, Google account identifier, and profile picture if requested and used.
              </p>
              <p>
                We use this information to authenticate you, create or update your Website account, assign the Website access role, maintain your signed-in session, and provide account-related features. The Website&apos;s sign-in functionality does not request access to Gmail messages, Google Drive files, contacts, or other Google services. If a future feature requires additional Google data, we will request the relevant permission and update the applicable disclosures before using that data for a new purpose.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--grey-800)", marginBottom: 8 }}>
                1.2 Account, role and session information
              </h3>
              <p>
                We may process account identifiers, assigned Website roles, authentication-related records and session information needed to maintain account functionality and protect the Website. Under the current role rules, an account using an @bmsit.in email address is assigned the member role, while an account using an @gmail.com email address is assigned the public role. These email-domain rules control Website access and do not independently verify a person&apos;s identity, college enrolment, employment or eligibility for a specific activity.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--grey-800)", marginBottom: 8 }}>
                1.3 Recruitment applications
              </h3>
              <p>
                If you apply for recruitment, we process the information you submit through the application form. Depending on the recruitment cycle and form, this may include identifying and contact details, team choices, application responses and other fields displayed to you. Where the two-team application limit is enabled for a recruitment cycle, application records may be used to administer and enforce that limit.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--grey-800)", marginBottom: 8 }}>
                1.4 Events, attendance and certificates
              </h3>
              <p>
                For club events and activities, we may process registration details, team information, attendance records, participation status and certificate details, as applicable to the event. We use these records to administer activities, verify participation and issue or verify certificates.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--grey-800)", marginBottom: 8 }}>
                1.5 Website requests and newsletter subscriptions
              </h3>
              <p style={{ marginBottom: 12 }}>
                If you use a website form such as “Join Us” or submit an enquiry, we process the information you provide, which may include your name, email address and the message or interests entered into the form. We use it to respond to your request, consider participation enquiries and communicate with you about the relevant club activity.
              </p>
              <p>
                If you subscribe to the Club newsletter, we process your email address and subscription status to send club updates. You may unsubscribe using the mechanism provided in a newsletter message or by contacting us at{" "}
                <a href="mailto:codingclub@bmsit.in" style={{ color: "var(--grey-900)" }}>
                  codingclub@bmsit.in
                </a>
                .
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--grey-800)", marginBottom: 8 }}>
                1.6 Technical and security information
              </h3>
              <p>
                The Website and its hosting or security infrastructure may generate operational records such as request timestamps, error information and security logs. Depending on the deployed configuration and provider, these records may include IP addresses or other technical identifiers used to operate, troubleshoot and protect the Website.
              </p>
            </div>
          </section>

          {/* 2. How We Use Information */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              2. How We Use Information
            </h2>
            <p style={{ marginBottom: 14 }}>
              We use personal information for purposes connected with operating and administering the Website, including to:
            </p>
            <ul style={{ paddingLeft: 24, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>authenticate users, create or update accounts, maintain sessions and assign Website roles;</li>
              <li>process recruitment applications and communicate with applicants;</li>
              <li>respond to website forms and enquiries, and send newsletter updates to users who subscribe;</li>
              <li>organize club events, manage registrations and attendance, and issue or verify certificates;</li>
              <li>maintain club administrative records and respond to user requests;</li>
              <li>diagnose errors, protect accounts, prevent abuse, investigate security issues and maintain the Website; and</li>
              <li>meet applicable legal obligations and address legitimate legal or security concerns.</li>
            </ul>
            <p>
              We do not intentionally use personal information for behavioural advertising, and we do not intentionally use advertising or analytics trackers as part of the Website&apos;s intended functionality.
            </p>
          </section>

          {/* 3. Google User Data */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              3. Google User Data
            </h2>
            <p style={{ marginBottom: 14 }}>
              Google account information is used for the sign-in and Website account purposes described in this Policy. It may be stored in the Website&apos;s database where needed to maintain your account and may be processed by the authentication service and infrastructure providers operating the Website.
            </p>
            <p style={{ marginBottom: 14 }}>
              We do not sell Google user data, use it to serve advertisements, or use it for purposes unrelated to providing the Website features described here. We do not request Gmail or Google Drive access as part of the described sign-in functionality. We do not use Google user data to train generalized artificial-intelligence or machine-learning models.
            </p>
            <p style={{ marginBottom: 14 }}>
              Our access to and use of information received through Google APIs will comply with the Google API Services User Data Policy, including its Limited Use requirements. We will update this Policy and request additional permission or consent where required before using Google user data for a new purpose.
            </p>
            <p>
              Google also processes information under its own terms and privacy policies. Your use of Google Sign-In is subject to Google&apos;s applicable terms.
            </p>
          </section>

          {/* 4. Storage and Service Providers */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              4. Storage and Service Providers
            </h2>
            <p style={{ marginBottom: 14 }}>
              The Website uses a SQL database for relevant account and application records. Recruitment or related records may also be handled in Google Sheets where an integration is enabled for the relevant process. Information may be processed by providers used to host, authenticate, store, secure, back up or otherwise operate the Website, where those services are configured.
            </p>
            <p>
              We aim to limit access to personal information to people and services that need it for their assigned responsibilities. Access to recruitment, event, attendance and certificate records should be limited according to the relevant administrative purpose.
            </p>
          </section>

          {/* 5. Sharing of Information */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              5. Sharing of Information
            </h2>
            <p style={{ marginBottom: 14 }}>
              We do not sell personal information. Information may be accessed or shared only as reasonably necessary in the following circumstances:
            </p>
            <ul style={{ paddingLeft: 24, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>
                <strong>Club administration:</strong> authorised club personnel may access records needed for recruitment, events, attendance, certificates and account support.
              </li>
              <li>
                <strong>Service providers:</strong> providers may process information to host, authenticate, maintain, secure, back up or operate the Website.
              </li>
              <li>
                <strong>Event administration:</strong> relevant information may be made available to authorised organisers when needed to administer an activity or verify participation.
              </li>
              <li>
                <strong>Legal and security matters:</strong> information may be disclosed where required by law or reasonably necessary to address security incidents, fraud, abuse or legal claims.
              </li>
            </ul>
            <p>
              Google user data is not shared for advertising or sold, and any processing or transfer of it is limited to the purposes and circumstances permitted by the Google API Services User Data Policy.
            </p>
          </section>

          {/* 6. Data Retention and Deletion */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              6. Data Retention and Deletion
            </h2>
            <p style={{ marginBottom: 14 }}>
              We retain personal information only for as long as reasonably necessary for the purposes described in this Policy, including account administration, recruitment, event management, certificate verification, security and applicable recordkeeping. Retention may differ between account records, recruitment applications, attendance records, certificates, backups and technical logs.
            </p>
            <p>
              When information is no longer needed, we intend to delete it or otherwise dispose of it appropriately, subject to applicable legal requirements, legitimate administrative or security needs, and technical backup cycles. Deleting a Website account may not immediately remove copies held separately in spreadsheets, backups or records that must lawfully be retained.
            </p>
          </section>

          {/* 7. Security */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              7. Security
            </h2>
            <p style={{ marginBottom: 14 }}>
              We seek to maintain reasonable technical and organisational measures appropriate to the Website to protect personal information against unauthorised access, loss, alteration or disclosure. Measures may include access restrictions, authentication controls, secure communications, and appropriate credential and database-permission management. The responsible team should ensure that the controls used in practice match the Website&apos;s risk and configuration.
            </p>
            <p>
              No website or electronic storage system can be guaranteed to be completely secure. If you suspect unauthorised access to your account or a privacy issue, contact us promptly at{" "}
              <a href="mailto:codingclub@bmsit.in" style={{ color: "var(--grey-900)" }}>
                codingclub@bmsit.in
              </a>
              .
            </p>
          </section>

          {/* 8. Your Privacy Requests */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              8. Your Privacy Requests
            </h2>
            <p style={{ marginBottom: 14 }}>
              You may contact{" "}
              <a href="mailto:codingclub@bmsit.in" style={{ color: "var(--grey-900)" }}>
                codingclub@bmsit.in
              </a>{" "}
              to ask about personal information associated with your account or to request access, correction or deletion where applicable. Please describe your request and provide enough information for us to identify the relevant account or record. Do not send passwords, authentication tokens or unnecessary sensitive information.
            </p>
            <p>
              We will review requests and respond in accordance with applicable requirements. We may need to retain certain records for legitimate administrative, security or legal reasons. Account deletion does not itself revoke your Google account or guarantee immediate removal of every copy maintained in separate systems or backups.
            </p>
          </section>

          {/* 9. Cookies and Sessions */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              9. Cookies and Sessions
            </h2>
            <p>
              The Website may use essential session cookies or other session and browser-storage mechanisms to support sign-in, maintain your session and provide account functionality. Hosting or security infrastructure may also generate technical logs. We do not intentionally use advertising trackers or behavioural advertising as part of the Website&apos;s intended functionality.
            </p>
          </section>

          {/* 10. Children's Privacy and Eligibility */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              10. Children&apos;s Privacy and Eligibility
            </h2>
            <p>
              The Website is intended for people using the club&apos;s website and activities, subject to any applicable eligibility requirements. We do not knowingly seek to collect personal information from children in circumstances where collection is not permitted. Where applicable law requires parental consent, age-related safeguards or other protections, those requirements must be followed.
            </p>
          </section>

          {/* 11. Third-Party Services and Links */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              11. Third-Party Services and Links
            </h2>
            <p>
              The Website may link to third-party websites or use third-party services, including Google authentication and infrastructure services. Those services operate under their own terms and privacy policies. We do not control the privacy practices of external websites that we do not operate, so please review their policies before providing them with personal information.
            </p>
          </section>

          {/* 12. Changes to This Policy */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 16 }}>
              12. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy when the Website, our data practices or applicable requirements change. The revised Policy will be published on this page with an updated revision date. Where required, we will provide additional notice or obtain consent before applying a change.
            </p>
          </section>

          {/* 13. Contact Us */}
          <section style={{ marginBottom: 36, padding: "24px", background: "var(--grey-50)", borderRadius: 12, border: "1px solid var(--grey-200)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--grey-900)", marginBottom: 12 }}>
              13. Contact Us
            </h2>
            <p style={{ marginBottom: 12 }}>
              For privacy questions, access requests, correction requests, deletion requests or other privacy-related concerns, contact:
            </p>
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

          <p style={{ fontSize: 12, color: "var(--grey-500)", fontStyle: "italic", borderTop: "1px solid var(--grey-200)", paddingTop: 20 }}>
            This Policy describes the Website&apos;s intended data practices. Its publication does not, by itself, establish compliance with every legal requirement or verify that every technical control is implemented.
          </p>
        </div>
      </div>
    </div>
  );
}
