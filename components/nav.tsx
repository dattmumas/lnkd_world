"use client";

import Link from "next/link";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function Nav() {
  const { signOut } = useAuthActions();

  return (
    <header className="flex justify-between items-center py-6 border-b border-[var(--color-border)]">
      <Link
        href="/"
        className="text-sm tracking-widest uppercase text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
      >
        LNKD
      </Link>
      <nav className="flex gap-3 md:gap-6 items-center overflow-x-auto">
        <Link
          href="/writing"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shrink-0"
        >
          Writing
        </Link>
        <Link
          href="/reading"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shrink-0"
        >
          Reading
        </Link>
        <Link
          href="/bookmarks"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shrink-0 hidden sm:block"
        >
          Bookmarks
        </Link>
        <Link
          href="/resources"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shrink-0 hidden sm:block"
        >
          Resources
        </Link>
        <Authenticated>
          <button
            onClick={() => void signOut()}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            Sign Out
          </button>
        </Authenticated>
        <Unauthenticated>
          <Link
            href="/subscribe"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            Subscribe
          </Link>
        </Unauthenticated>
      </nav>
    </header>
  );
}
