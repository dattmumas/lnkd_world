"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function EnsureUser() {
  const ensureUser = useMutation(api.users.ensureUser);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    void ensureUser();
  }, [ensureUser]);

  return null;
}
