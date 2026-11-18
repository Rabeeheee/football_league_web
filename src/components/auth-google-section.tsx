"use client";

import { useEffect, useState } from "react";
import { getProviders } from "next-auth/react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import type { SignupIntent } from "@/lib/roles";

export function AuthGoogleSection({
  label,
  intent = "visitor",
}: {
  label?: string;
  intent?: SignupIntent;
}) {
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);

  useEffect(() => {
    void getProviders().then((providers) => {
      setGoogleReady(!!providers?.google);
    });
  }, []);

  if (googleReady === null) {
    return (
      <div className="h-11 animate-pulse rounded-lg bg-white/10" aria-hidden />
    );
  }

  if (!googleReady) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
        Google sign-in is not configured yet. Add{" "}
        <code className="text-amber-50">GOOGLE_CLIENT_ID</code> and{" "}
        <code className="text-amber-50">GOOGLE_CLIENT_SECRET</code> to{" "}
        <code className="text-amber-50">.env</code>, then restart the server.
      </p>
    );
  }

  return (
    <GoogleSignInButton
      label={label}
      intent={intent}
      callbackUrl={intent === "admin" ? "/pending-admin" : "/"}
    />
  );
}
