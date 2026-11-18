"use client";

import { useState } from "react";
import type { Team, Tournament, User } from "@prisma/client";
import Link from "next/link";
import { ImageUpload } from "@/components/image-upload";

type TeamWithManager = Team & {
  manager: Pick<User, "id" | "name" | "email"> | null;
  _count: { players: number };
};

type PendingAdmin = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string | Date;
};

type Props = {
  tournament: Tournament;
  teams: TeamWithManager[];
  pendingAdmins: PendingAdmin[];
};

export function AdminPanel({
  tournament: initial,
  teams: initialTeams,
  pendingAdmins: initialPending,
}: Props) {
  const [tournament, setTournament] = useState(initial);
  const [teams, setTeams] = useState(initialTeams);
  const [pending, setPending] = useState(initialPending);
  const [name, setName] = useState(initial.name);
  const [teamSlots, setTeamSlots] = useState(initial.teamSlots);
  const [entryFee, setEntryFee] = useState(initial.entryFee);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPassword, setManagerPassword] = useState("");

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tournament", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, teamSlots, entryFee }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTournament(data.tournament);
      setMsg("Tournament settings saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          logoUrl: logoUrl || null,
          managerEmail: managerEmail || null,
          managerName: managerName || null,
          managerPassword: managerPassword || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTeams((prev) =>
        [
          ...prev,
          { ...data.team, _count: { players: data.team.players.length } },
        ].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setTeamName("");
      setLogoUrl("");
      setManagerEmail("");
      setManagerName("");
      setManagerPassword("");
      setMsg(`Created team ${data.team.name}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeam(id: string) {
    if (!confirm("Delete this team?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTeams((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function reviewAdmin(userId: string, action: "approve" | "reject") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPending((prev) => prev.filter((u) => u.id !== userId));
      setMsg(
        action === "approve"
          ? `${data.user.name} is now a league admin`
          : `${data.user.name}'s admin request was rejected`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-10">
      {msg && (
        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
          {msg}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6">
        <h2 className="font-display text-xl text-white">Admin requests</h2>
        <p className="mt-1 text-sm text-white/50">
          Users who signed up as admin after you need your approval.
        </p>
        <ul className="mt-4 divide-y divide-white/10">
          {pending.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium text-white">{user.name}</p>
                <p className="text-xs text-white/50">{user.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => reviewAdmin(user.id, "approve")}
                  className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-400 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => reviewAdmin(user.id, "reject")}
                  className="rounded px-3 py-1 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
          {pending.length === 0 && (
            <li className="py-3 text-sm text-white/50">No pending requests.</li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6">
        <h2 className="font-display text-xl text-white">Tournament settings</h2>
        <p className="mt-1 text-sm text-white/50">
          Set how many teams can enter. Entry fee is charged per person and
          shown on the site (payment offline).
        </p>
        <form
          onSubmit={saveSettings}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          <label className="block text-sm text-white/70">
            League name
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm text-white/70">
            Team slots
            <input
              type="number"
              min={2}
              max={64}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={teamSlots}
              onChange={(e) => setTeamSlots(Number(e.target.value))}
              required
            />
          </label>
          <label className="block text-sm text-white/70">
            Entry fee per person (₹)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={entryFee}
              onChange={(e) => setEntryFee(Number(e.target.value))}
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 sm:col-span-3 sm:w-fit sm:py-2"
          >
            Save settings
          </button>
        </form>
        <p className="mt-3 text-xs text-white/40">
          {teams.length} / {tournament.teamSlots} teams registered
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6">
        <h2 className="font-display text-xl text-white">Create team</h2>
        <form onSubmit={createTeam} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-white/70">
            Team name
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </label>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm text-white/70">Team logo</p>
            <ImageUpload
              value={logoUrl || null}
              onChange={setLogoUrl}
              label="Upload logo from gallery"
              round
            />
          </div>
          <label className="block text-sm text-white/70">
            Manager email (optional)
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm text-white/70">
            Manager name (if new)
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </label>
          <label className="block text-sm text-white/70 sm:col-span-2">
            Manager password (if new)
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60 sm:w-fit sm:py-2"
          >
            Add team
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6">
        <h2 className="font-display text-xl text-white">Teams</h2>
        <ul className="mt-4 divide-y divide-white/10">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex items-center gap-3">
                {team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logoUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-800 text-white">
                    {team.name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <Link
                    href={`/teams/${team.id}`}
                    className="font-medium text-white hover:underline"
                  >
                    {team.name}
                  </Link>
                  <p className="text-xs text-white/50">
                    Manager:{" "}
                    {team.manager
                      ? `${team.manager.name} (${team.manager.email})`
                      : "Unassigned"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteTeam(team.id)}
                className="rounded px-3 py-1 text-sm text-red-300 hover:bg-red-500/20"
              >
                Delete
              </button>
            </li>
          ))}
          {teams.length === 0 && (
            <li className="py-4 text-sm text-white/50">No teams yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
