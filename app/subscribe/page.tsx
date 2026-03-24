"use client";

import Link from "next/link";
import Nav from "@/components/nav";
import SignInForm from "@/components/sign-in-form";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

function SignedInState() {
  const { signOut } = useAuthActions();

  return (
    <>
      <h1 className="text-3xl font-semibold mb-4">You&apos;re signed in</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        You have access to subscriber resources.
      </p>
      <div className="flex gap-4">
        <Link
          href="/resources"
          className="text-[var(--color-accent)] hover:underline underline-offset-4"
        >
          View Resources
        </Link>
        <button
          onClick={() => void signOut()}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Sign out
        </button>
      </div>
    </>
  );
}

export default function Subscribe() {
  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-6">
      <Nav />
      <main className="flex-1 py-16 md:py-24 max-w-sm mx-auto w-full">
        <AuthLoading>
          <p className="text-[var(--color-text-secondary)] text-center">
            Loading...
          </p>
        </AuthLoading>
        <Authenticated>
          <SignedInState />
        </Authenticated>
        <Unauthenticated>
          <h1 className="text-3xl font-semibold mb-4">Subscribe</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Sign up to get access to exclusive resources and tools.
          </p>
          <SignInForm />
        </Unauthenticated>
      </main>
    </div>
  );
}
