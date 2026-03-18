"use client";

import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "@/convex/_generated/api";
import SignInForm from "@/components/sign-in-form";

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

  if (user === undefined || (user === null)) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (!user.role || ROLE_LEVEL[user.role] < ROLE_LEVEL[role]) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)]">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
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
        <div className="max-w-sm mx-auto px-6 py-16">
          <h1 className="text-2xl font-semibold mb-6 text-center">Sign In</h1>
          <SignInForm />
        </div>
      </Unauthenticated>
      <Authenticated>
        <RoleCheck role={role}>{children}</RoleCheck>
      </Authenticated>
    </>
  );
}
