"use client";

import Link from "next/link";
import Nav from "@/components/nav";
import ForgotPasswordForm from "@/components/forgot-password-form";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

function ResetDone() {
  return (
    <>
      <h1 className="text-3xl font-semibold mb-4">Password updated</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        You&apos;re signed in with your new password.
      </p>
      <div className="flex gap-4">
        <Link
          href="/resources"
          className="text-[var(--color-accent)] hover:underline underline-offset-4"
        >
          View Resources
        </Link>
      </div>
    </>
  );
}

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex flex-col w-full px-6 lg:px-12">
      <Nav />
      <main className="flex-1 py-16 md:py-24 max-w-sm mx-auto w-full">
        <AuthLoading>
          <p className="text-[var(--color-text-secondary)] text-center">Loading...</p>
        </AuthLoading>
        <Authenticated>
          <ResetDone />
        </Authenticated>
        <Unauthenticated>
          <h1 className="text-3xl font-semibold mb-4">Reset password</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Enter your email and we&apos;ll send a code to set a new password.
          </p>
          <ForgotPasswordForm />
        </Unauthenticated>
      </main>
    </div>
  );
}
