"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

function AdminBar() {
  const user = useQuery(api.users.currentUser);
  if (!user || user.role !== "admin") return null;

  return (
    <div className="bg-[var(--color-accent)] text-white text-xs py-1.5 -mx-6 px-6 flex gap-4 items-center overflow-x-auto">
      <span className="font-semibold shrink-0">Admin</span>
      <Link href="/admin" className="hover:underline underline-offset-2 shrink-0">Dashboard</Link>
      <Link href="/admin/posts" className="hover:underline underline-offset-2 shrink-0">Posts</Link>
      <Link href="/admin/readings" className="hover:underline underline-offset-2 shrink-0">Readings</Link>
      <Link href="/admin/bookmarks" className="hover:underline underline-offset-2 shrink-0">Bookmarks</Link>
      <Link href="/admin/resources" className="hover:underline underline-offset-2 shrink-0">Resources</Link>
      <Link href="/admin/projects" className="hover:underline underline-offset-2 shrink-0">Projects</Link>
    </div>
  );
}

export default function Nav() {
  const { signOut } = useAuthActions();

  return (
    <>
      <Authenticated>
        <AdminBar />
      </Authenticated>
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
            href="/bonds"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shrink-0"
          >
            Bonds
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
    </>
  );
}
