"use client";

import Link from "next/link";
import Nav from "@/components/nav";
import { useAuthActions } from "@convex-dev/auth/react";

export default function AdminDashboard() {
  const { signOut } = useAuthActions();

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 md:py-24">
      <Nav />
      <div className="flex justify-between items-center mt-8 mb-8">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <button
          onClick={() => void signOut()}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Sign out
        </button>
      </div>
      <ul className="space-y-4">
        <li>
          <Link
            href="/admin/links"
            className="text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            Manage Links
          </Link>
        </li>
        <li>
          <Link
            href="/admin/resources"
            className="text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            Manage Resources
          </Link>
        </li>
      </ul>
    </main>
  );
}
