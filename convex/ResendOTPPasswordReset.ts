import Resend from "@auth/core/providers/resend";

/**
 * Password-reset delivery for the Convex Auth `Password` provider.
 *
 * Convex Auth owns the reset *machinery* (generating, storing, and verifying the
 * code, then swapping the password hash). This provider only supplies the two
 * things the library leaves to us: how to mint the code and how to deliver it.
 *
 * Requires the `resend_api` env var on the Convex deployment (set per-deployment;
 * dev and prod are separate). Read it back with `npx convex env list`.
 */

// Sender address. For delivery to arbitrary recipients this must be a verified
// domain in Resend. `onboarding@resend.dev` works without verifying a domain but
// only delivers to the Resend account owner's own email — fine for testing. Once
// you verify a domain, set RESEND_FROM (e.g. "LNKD <noreply@lnkd.world>") on the
// deployment and no code change is needed.
const FROM = process.env.RESEND_FROM ?? "LNKD <onboarding@resend.dev>";

// 8-digit numeric code, generated in the Convex runtime (Web Crypto, no deps).
function generateResetCode(length = 8): string {
  const digits = "0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += digits[bytes[i] % 10];
  }
  return code;
}

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-reset",
  apiKey: process.env.resend_api,
  async generateVerificationToken() {
    return generateResetCode(8);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.resend_api}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: "Reset your LNKD password",
        text: `Your LNKD password reset code is ${token}\n\nEnter it on the password reset page to choose a new password. If you didn't request this, you can safely ignore this email.`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend error: ${JSON.stringify(await res.json())}`);
    }
  },
});
