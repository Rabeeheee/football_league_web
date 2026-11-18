"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthGoogleSection } from "@/components/auth-google-section";
import { RoleIntentPicker } from "@/components/role-intent-picker";
import type { SignupIntent } from "@/lib/roles";

export default function RegisterPage() {
  const router = useRouter();
  const [intent, setIntent] = useState<SignupIntent>("visitor");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, intent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (login?.error) {
        router.push("/login");
        return;
      }
      router.push(data.user?.role === "PENDING_ADMIN" ? "/pending-admin" : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-3 py-8 sm:px-4 sm:py-12">
      <h1 className="font-display text-2xl text-white sm:text-3xl">
        Join the league
      </h1>
      <p className="mt-2 text-sm text-white/60">
        Choose visitor or admin before you enter. The first admin becomes the
        league admin; later admin requests need their approval.
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
            Name
            <input
              required
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
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
              minLength={6}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-300 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
