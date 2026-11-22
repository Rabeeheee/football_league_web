"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { ImageUpload } from "@/components/image-upload";

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  hasPassword: boolean;
  managedTeam: { id: string; name: string } | null;
};

export function ProfileForm({ initial }: { initial: ProfileUser }) {
  const { update } = useSession();
  const [name, setName] = useState(initial.name);
  const [image, setImage] = useState<string | null>(initial.image);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          image,
          ...(newPassword
            ? {
                newPassword,
                ...(hasPassword ? { currentPassword } : {}),
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setHasPassword(data.user.hasPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await update({ name: data.user.name, image: data.user.image });
      setMsg("Profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel =
    initial.role === "LEAGUE_ADMIN"
      ? "League admin"
      : initial.role === "TEAM_MANAGER"
        ? "Team manager"
        : initial.role === "PENDING_ADMIN"
          ? "Pending admin"
          : "Visitor";

  return (
    <form onSubmit={onSave} className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <ImageUpload
          value={image}
          onChange={setImage}
          label="Change photo"
          round
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="font-display text-2xl text-white">{name || "Your name"}</p>
          <p className="mt-1 truncate text-sm text-white/50">{initial.email}</p>
          <p className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            {roleLabel}
          </p>
          {initial.managedTeam && (
            <p className="mt-3 text-sm text-white/55">
              Managing{" "}
              <Link
                href={`/teams/${initial.managedTeam.id}`}
                className="font-semibold text-emerald-300 hover:underline"
              >
                {initial.managedTeam.name}
              </Link>
            </p>
          )}
        </div>
      </div>

      <label className="block text-sm text-white/70">
        Display name
        <input
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
        />
      </label>

      <label className="block text-sm text-white/70">
        Email
        <input
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white/50"
          value={initial.email}
          disabled
          readOnly
        />
      </label>

      <fieldset className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
        <legend className="px-1 text-sm font-semibold text-white/80">
          {hasPassword ? "Change password" : "Set a password"}
        </legend>
        <p className="text-xs text-white/40">
          {hasPassword
            ? "Leave blank to keep your current password."
            : "Optional — lets you also sign in with email."}
        </p>
        {hasPassword && (
          <label className="block text-sm text-white/70">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-white"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
        )}
        <label className="block text-sm text-white/70">
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-white"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label className="block text-sm text-white/70">
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-white"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-60 sm:w-auto"
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
