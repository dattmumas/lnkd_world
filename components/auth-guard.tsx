"use client";

import { ReactNode, useEffect } from "react";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";

type Role = "admin" | "subscriber";

const ROLE_LEVEL: Record<Role, number> = {
  subscriber: 1,
  admin: 2,
};

function RoleCheck({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const user = useQuery(api.users.currentUser);
  const router = useRouter();

  const insufficientRole = user !== undefined && user !== null &&
    (!user.role || ROLE_LEVEL[user.role] < ROLE_LEVEL[role]);

  useEffect(() => {
    if (insufficientRole) {
      router.replace("/");
    }
  }, [insufficientRole, router]);

  if (user === undefined || user === null) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (insufficientRole) {
    return null;
  }

  return <>{children}</>;
}

function RedirectHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/subscribe");
  }, [router]);
  return (
    <div className="max-w-lg mx-auto px-6 py-16 text-center">
      <p className="text-[var(--color-text-secondary)]">Redirecting...</p>
    </div>
  );
}

export default function AuthGuard({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  return (
    <>
      <AuthLoading>
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <p className="text-[var(--color-text-secondary)]">Loading...</p>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <RedirectHome />
      </Unauthenticated>
      <Authenticated>
        <RoleCheck role={role}>{children}</RoleCheck>
      </Authenticated>
    </>
  );
}
