"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth, type AuthView } from "@/app/lib/auth";
import { Modal, Field, FormError, FormSuccess } from "./ui";

// Allowed email domains — must match ALLOWED_EMAIL_DOMAIN in backend/.env
const ALLOWED_DOMAINS = ["@bmsit.in", "@gmail.com"];
const PRIMARY_DOMAIN = "@bmsit.in"; // shown in placeholders / hints

export default function AuthModal() {
  const {
    authModalOpen,
    closeAuth,
    authView,
    setAuthView,
    presetEmail,
    login,
    signup,
    verifyEmail,
    refresh,
  } = useAuth();

  return (
    <Modal open={authModalOpen} onClose={closeAuth}>
      {authView === "login" && <LoginForm onSwitch={setAuthView} onDone={closeAuth} login={login} />}
      {authView === "signup" && (
        <SignupForm onSwitch={setAuthView} signup={signup} presetEmail={presetEmail} />
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
  );
}

/* ---------------- Login ---------------- */
function LoginForm({
  onSwitch,
  onDone,
  login,
}: {
  onSwitch: (v: AuthView) => void;
  onDone: () => void;
  login: (e: string, p: string) => Promise<unknown>;
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

  return (
    <form onSubmit={onSubmit}>
      <span className="modal-eyebrow">// Welcome back</span>
      <h2 className="modal-title">Sign in</h2>
      <p className="modal-sub">Use your {PRIMARY_DOMAIN} account to continue.</p>
      <FormError>{error}</FormError>
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
        {busy ? "Signing in…" : "Sign in"}
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

/* ---------------- Signup ---------------- */
function SignupForm({
  onSwitch,
  signup,
  presetEmail,
}: {
  onSwitch: (v: AuthView) => void;
  signup: (n: string, e: string, p: string) => Promise<void>;
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
      // auth context moves the modal to the verify view automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <span className="modal-eyebrow">// Join the club</span>
      <h2 className="modal-title">Create account</h2>
      <p className="modal-sub">
        Registration is open to BMS Institute students — use your{" "}
        <strong>{PRIMARY_DOMAIN}</strong> email address.
      </p>
      <FormError>{error}</FormError>
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
        {busy ? "Creating…" : "Create account"}
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

/* ---------------- Verify email ---------------- */
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
      setInfo("Email verified! Signing you in…");
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
        We sent a 6-digit code to your {PRIMARY_DOMAIN} inbox. In development it&apos;s also printed
        in the backend console.
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
        {busy ? "Verifying…" : "Verify & continue"}
      </button>
      <div className="modal-switch">
        <button type="button" onClick={() => onSwitch("login")}>
          Back to sign in
        </button>
      </div>
    </form>
  );
}
