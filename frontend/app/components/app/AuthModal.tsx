"use client";

import { useEffect, useState, type FormEvent } from "react";
import Script from "next/script";
import { useAuth, type AuthView } from "@/app/lib/auth";
import { Modal, Field, FormError, FormSuccess } from "./ui";

const ALLOWED_DOMAINS = ["@bmsit.in", "@gmail.com"];
const PRIMARY_DOMAIN = "@bmsit.in";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function AuthModal() {
  const {
    authModalOpen,
    closeAuth,
    authView,
    setAuthView,
    presetEmail,
    login,
    googleLogin,
    signup,
    verifyEmail,
    refresh,
  } = useAuth();

  return (
    <>
      {GOOGLE_CLIENT_ID && (
        <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />
      )}
      <Modal open={authModalOpen} onClose={closeAuth}>
        {authView === "login" && (
          <LoginForm onSwitch={setAuthView} onDone={closeAuth} login={login} googleLogin={googleLogin} />
        )}
        {authView === "signup" && (
          <SignupForm onSwitch={setAuthView} signup={signup} googleLogin={googleLogin} presetEmail={presetEmail} />
        )}
        {authView === "verify" && (
          <VerifyForm
            presetEmail={presetEmail}
            verifyEmail={verifyEmail}
            onVerified={async () => {
              await refresh();
              closeAuth();
            }}
            onSwitch={setAuthView}
          />
        )}
      </Modal>
    </>
  );
}

function GoogleSignInButton({
  onCredential,
  busy,
  text = "Continue with Google",
}: {
  onCredential: (c: string) => Promise<void>;
  busy: boolean;
  text?: string;
}) {
  const [gError, setGError] = useState("");

  function handleClick() {
    if (busy) return;
    setGError("");
    if (!GOOGLE_CLIENT_ID) {
      setGError("Google sign-in is not configured.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      setGError("Google script not loaded - try again.");
      return;
    }
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp: { credential: string }) => {
        try {
          await onCredential(resp.credential);
        } catch (err) {
          setGError(err instanceof Error ? err.message : "Google sign-in failed");
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    google.accounts.id.prompt();
  }

  return (
    <div className="google-auth-block" style={{ width: "100%", marginTop: "4px" }}>
      <button
        type="button"
        className="btn-google"
        onClick={handleClick}
        disabled={busy}
        aria-label={text}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          width: "100%",
          padding: "13px 24px",
          borderRadius: "100px",
          border: "1.5px solid var(--grey-200, #d2d2d7)",
          background: "var(--white, #ffffff)",
          color: "var(--grey-900, #0a0a0a)",
          fontSize: "13.5px",
          fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
          letterSpacing: "0.04em",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          transition: "all 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
          <path
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.253 17.64 11.945 17.64 9.2z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"
            fill="#EA4335"
          />
        </svg>
        <span>{busy ? "Connecting..." : text}</span>
      </button>
      {gError && (
        <p className="form-error-inline" style={{ marginTop: "8px" }}>
          {gError}
        </p>
      )}
    </div>
  );
}

function LoginForm({
  onSwitch,
  onDone,
  login,
  googleLogin,
}: {
  onSwitch: (v: AuthView) => void;
  onDone: () => void;
  login: (e: string, p: string) => Promise<unknown>;
  googleLogin: (c: string) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(credential: string) {
    setBusy(true);
    setError("");
    try {
      await googleLogin(credential);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <span className="modal-eyebrow">// Welcome back</span>
      <h2 className="modal-title">Sign in</h2>
      <p className="modal-sub">Use your BMSIT or Google account to continue.</p>
      <FormError>{error}</FormError>

      <GoogleSignInButton onCredential={handleGoogle} busy={busy} text="Continue with Google" />

      <div
        className="auth-divider"
        style={{
          display: "flex",
          alignItems: "center",
          textAlign: "center",
          margin: "20px 0 18px",
          color: "var(--grey-400, #86868b)",
          fontSize: "11px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ padding: "0 12px" }}>or continue with email</span>
      </div>

      <Field label="Email" required>
        <input
          className="input"
          type="email"
          autoComplete="email"
          placeholder={`you${PRIMARY_DOMAIN}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field label="Password" required>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <button className="btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </button>

      <div className="modal-switch">
        New here?{" "}
        <button type="button" onClick={() => onSwitch("signup")}>
          Create an account
        </button>
      </div>
      <div className="modal-switch">
        Didn&apos;t get a code?{" "}
        <button type="button" onClick={() => onSwitch("verify")}>
          Verify email
        </button>
      </div>
    </form>
  );
}

function SignupForm({
  onSwitch,
  signup,
  googleLogin,
  presetEmail,
}: {
  onSwitch: (v: AuthView) => void;
  signup: (n: string, e: string, p: string) => Promise<void>;
  googleLogin: (c: string) => Promise<unknown>;
  presetEmail: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const em = email.trim().toLowerCase();
    if (!ALLOWED_DOMAINS.some((d) => em.endsWith(d))) {
      setError(`Only ${ALLOWED_DOMAINS.join(" or ")} email addresses can register.`);
      return;
    }
    setBusy(true);
    try {
      await signup(name.trim(), em, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(credential: string) {
    setBusy(true);
    setError("");
    try {
      await googleLogin(credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <span className="modal-eyebrow">// Join the club</span>
      <h2 className="modal-title">Create account</h2>
      <p className="modal-sub">
        Registration is open to BMS Institute students — use your <strong>{PRIMARY_DOMAIN}</strong> or Google account.
      </p>
      <FormError>{error}</FormError>

      <GoogleSignInButton onCredential={handleGoogle} busy={busy} text="Sign up with Google" />

      <div
        className="auth-divider"
        style={{
          display: "flex",
          alignItems: "center",
          textAlign: "center",
          margin: "20px 0 18px",
          color: "var(--grey-400, #86868b)",
          fontSize: "11px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ padding: "0 12px" }}>or register with email</span>
      </div>

      <Field label="Full name" required>
        <input
          className="input"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <Field label="College email" required hint={`Use your ${PRIMARY_DOMAIN} address`}>
        <input
          className="input"
          type="email"
          autoComplete="email"
          placeholder={`you${PRIMARY_DOMAIN}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field label="Password" required hint="At least 8 characters">
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      <button className="btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Creating..." : "Create account"}
      </button>

      <div className="modal-switch">
        Already have an account?{" "}
        <button type="button" onClick={() => onSwitch("login")}>
          Sign in
        </button>
      </div>
    </form>
  );
}

function VerifyForm({
  presetEmail,
  verifyEmail,
  onVerified,
  onSwitch,
}: {
  presetEmail: string;
  verifyEmail: (e: string, c: string) => Promise<unknown>;
  onVerified: () => Promise<void>;
  onSwitch: (v: AuthView) => void;
}) {
  const [email, setEmail] = useState(presetEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => setEmail(presetEmail), [presetEmail]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await verifyEmail(email.trim().toLowerCase(), code.trim());
      setInfo("Email verified! Signing you in...");
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <span className="modal-eyebrow">// One more step</span>
      <h2 className="modal-title">Verify your email</h2>
      <p className="modal-sub">
        We sent a 6-digit code to your {PRIMARY_DOMAIN} inbox. In development it&apos;s also printed in the backend console.
      </p>
      <FormError>{error}</FormError>
      <FormSuccess>{info}</FormSuccess>
      <Field label="College email" required>
        <input
          className="input"
          type="email"
          placeholder={`you${PRIMARY_DOMAIN}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>
      <Field label="Verification code" required>
        <input
          className="input text-mono"
          type="text"
          inputMode="numeric"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          style={{ letterSpacing: "0.3em", fontSize: 18, textAlign: "center" }}
        />
      </Field>
      <button className="btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Verifying..." : "Verify & continue"}
      </button>
      <div className="modal-switch">
        <button type="button" onClick={() => onSwitch("login")}>
          Back to sign in
        </button>
      </div>
    </form>
  );
}
