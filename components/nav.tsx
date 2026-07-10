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
    <div className="bg-[#141210] text-[#F7F4EE] text-xs py-1.5 -mx-6 px-6 flex gap-4 items-center overflow-x-auto ol-mono">
      <span className="font-bold shrink-0">ADMIN</span>
      <Link href="/admin" className="hover:underline underline-offset-2 shrink-0">Dashboard</Link>
      <Link href="/admin/posts" className="hover:underline underline-offset-2 shrink-0">Posts</Link>
      <Link href="/admin/readings" className="hover:underline underline-offset-2 shrink-0">Readings</Link>
      <Link href="/admin/bookmarks" className="hover:underline underline-offset-2 shrink-0">Bookmarks</Link>
      <Link href="/admin/resources" className="hover:underline underline-offset-2 shrink-0">Resources</Link>
      <Link href="/admin/projects" className="hover:underline underline-offset-2 shrink-0">Projects</Link>
      <Link href="/admin/creators" className="hover:underline underline-offset-2 shrink-0">Creators</Link>
      <Link href="/admin/sources" className="hover:underline underline-offset-2 shrink-0">Sources</Link>
      <Link href="/admin/network" className="hover:underline underline-offset-2 shrink-0">Network</Link>
      <Link href="/admin/growth" className="hover:underline underline-offset-2 shrink-0">Growth</Link>
    </div>
  );
}

const navLink =
  "ol-mono text-xs font-bold uppercase text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] shrink-0";

export default function Nav() {
  const { signOut } = useAuthActions();

  return (
    <>
      <Authenticated>
        <AdminBar />
      </Authenticated>
      <header className="flex justify-between items-center py-5 border-b-2 border-[var(--color-border)]">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-[var(--color-text)] hover:text-[var(--color-accent)]"
          style={{ fontFamily: "var(--font-display), Helvetica, sans-serif" }}
        >
          ■ LNKD
        </Link>
        <nav className="flex gap-3 md:gap-5 items-center overflow-x-auto">
          <Link href="/onlabel" className={`${navLink} text-[var(--color-accent)]`}>
            On Label
          </Link>
          <Link href="/writing" className={navLink}>
            Writing
          </Link>
          <Link href="/reading" className={navLink}>
            Reading
          </Link>
          <Link href="/bonds" className={navLink}>
            Bonds
          </Link>
          <Link href="/bookmarks" className={`${navLink} hidden sm:block`}>
            Bookmarks
          </Link>
          <Link href="/resources" className={`${navLink} hidden sm:block`}>
            Resources
          </Link>
          <Authenticated>
            <button onClick={() => void signOut()} className={navLink}>
              Sign Out
            </button>
          </Authenticated>
          <Unauthenticated>
            <Link href="/subscribe" className={navLink}>
              Log In
            </Link>
          </Unauthenticated>
        </nav>
      </header>
    </>
  );
}
