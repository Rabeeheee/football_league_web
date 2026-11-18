"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGoogleSection } from "@/components/auth-google-section";
import { RoleIntentPicker } from "@/components/role-intent-picker";
import type { SignupIntent } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [intent, setIntent] = useState<SignupIntent>("visitor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-3 py-8 sm:px-4 sm:py-12">
      <h1 className="font-display text-2xl text-white sm:text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-white/60">
        New Google users: pick visitor or admin below first (first admin becomes
        league admin).
      </p>

      <div className="mt-8 space-y-5">
        <RoleIntentPicker value={intent} onChange={setIntent} />

        <AuthGoogleSection
          label={
            intent === "admin"
              ? "Continue with Google as admin"
              : "Continue with Google as visitor"
          }
          intent={intent}
        />

        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="h-px flex-1 bg-white/15" />
          or email
          <span className="h-px flex-1 bg-white/15" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm text-white/70">
            Email
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm text-white/70">
            Password
            <input
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 py-3 font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 sm:py-2.5"
          >
            {busy ? "Signing in…" : "Sign in with email"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-white/50">
        New here?{" "}
        <Link href="/register" className="text-emerald-300 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-white/30">
        Seed admin: admin@league.local / admin123
      </p>
    </main>
  );
}
