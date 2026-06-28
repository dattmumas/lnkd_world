"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Step 1: request a reset code by email.
  const requestCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await signIn("password", form);
      setEmail(form.get("email") as string);
      setStep("verify");
    } catch {
      setError("Couldn't send a reset code. Check the email and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: verify the code and set a new password (signs the user in on success).
  const verifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await signIn("password", form);
      // On success the user is signed in and Authenticated state takes over.
    } catch {
      setError("Invalid or expired code, or the password is too short (min 8).");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full border border-[var(--color-border)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";
  const buttonClass =
    "w-full bg-[var(--color-accent)] text-white rounded px-4 py-3 text-sm hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60";

  if (step === "request") {
    return (
      <form className="space-y-4" onSubmit={requestCode}>
        <input name="flow" type="hidden" value="reset" />
        <div>
          <label htmlFor="email" className="block text-sm mb-1">
            Email
          </label>
          <input id="email" name="email" type="email" required className={fieldClass} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? "Sending…" : "Send reset code"}
        </button>
        <Link
          href="/subscribe"
          className="block text-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Back to sign in
        </Link>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={verifyCode}>
      <input name="flow" type="hidden" value="reset-verification" />
      <input name="email" type="hidden" value={email} />
      <p className="text-sm text-[var(--color-text-secondary)]">
        We sent a code to <span className="text-[var(--color-text)]">{email}</span>. Enter it
        below with your new password.
      </p>
      <div>
        <label htmlFor="code" className="block text-sm mb-1">
          Reset code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="block text-sm mb-1">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          className={fieldClass}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className={buttonClass}>
        {submitting ? "Resetting…" : "Reset password"}
      </button>
      <button
        type="button"
        onClick={() => {
          setError("");
          setStep("request");
        }}
        className="w-full text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        Use a different email
      </button>
    </form>
  );
}
