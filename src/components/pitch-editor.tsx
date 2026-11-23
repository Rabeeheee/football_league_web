"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "@prisma/client";
import {
  FORMATIONS,
  applyFormationSlots,
  clampPitchPercent,
  detectFormationFromPositions,
  ensurePlayerCoords,
  getFormation,
  isPresetFormation,
} from "@/lib/pitch";
import { ImageUpload } from "@/components/image-upload";

type Props = {
  teamId: string;
  initialPlayers: Player[];
  initialFormation?: string | null;
  canEdit: boolean;
  teamName: string;
  logoUrl?: string | null;
  managerName?: string | null;
  managerImage?: string | null;
  starterCount?: number;
  subCount?: number;
};

const ROLE_LABELS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "CM",
  "LM",
  "RM",
  "ST",
  "LS",
  "RS",
  "SUB",
];

export function PitchEditor({
  teamId,
  initialPlayers,
  initialFormation,
  canEdit,
  teamName,
  logoUrl: initialLogo,
  managerName,
  managerImage,
  starterCount = 5,
  subCount = 2,
}: Props) {
  const initialFormationDef = getFormation(
    initialFormation || FORMATIONS[0]!.id,
  );
  const startingPlayers: Player[] = ensurePlayerCoords(
    initialPlayers,
    initialFormationDef,
  );
  const startingFormationId = initialFormation || initialFormationDef.id;
  const [players, setPlayers] = useState<Player[]>(() => startingPlayers);
  const [formationId, setFormationId] = useState(startingFormationId);
  const [logoUrl, setLogoUrl] = useState(initialLogo ?? null);
  const [baseline, setBaseline] = useState<{
    formationId: string;
    logoUrl: string | null;
    players: Player[];
  }>({
    formationId: startingFormationId,
    logoUrl: initialLogo ?? null,
    players: startingPlayers,
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );

  const starters = useMemo(
    () => players.filter((p) => p.role === "STARTER"),
    [players],
  );
  const subs = useMemo(
    () => players.filter((p) => p.role === "SUB"),
    [players],
  );
  const detectedFormation = useMemo(
    () => detectFormationFromPositions(players),
    [players],
  );
  const displayFormation = detectedFormation || formationId;
  const formationMeta = useMemo(
    () =>
      isPresetFormation(formationId)
        ? getFormation(formationId)
        : isPresetFormation(detectedFormation)
          ? getFormation(detectedFormation)
          : null,
    [formationId, detectedFormation],
  );
  const selected = players.find((p) => p.id === selectedId) ?? null;
  const activePlayer = players.find((p) => p.id === activeId) ?? null;

  function renamePlayer(id: string, name: string) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p)),
    );
  }

  function setAvatar(id: string, avatarUrl: string) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, avatarUrl } : p)),
    );
  }

  function setRoleLabel(id: string, pitchSlot: string) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, pitchSlot } : p)),
    );
  }

  function changeFormation(nextId: string) {
    const next = getFormation(nextId);
    setFormationId(nextId);
    setPlayers((prev) => applyFormationSlots(prev, next));
    setMessage("Formation applied — use Reset if that was a mistake");
  }

  function resetGamePlan() {
    setFormationId(baseline.formationId);
    setLogoUrl(baseline.logoUrl);
    setPlayers(baseline.players.map((p) => ({ ...p })));
    setSelectedId(null);
    setMessage("Reset to last saved game plan");
  }

  const isDirty = useMemo(() => {
    if (formationId !== baseline.formationId) return true;
    if ((logoUrl ?? null) !== (baseline.logoUrl ?? null)) return true;
    if (players.length !== baseline.players.length) return true;
    return players.some((p) => {
      const b = baseline.players.find((x) => x.id === p.id);
      if (!b) return true;
      return (
        p.name !== b.name ||
        p.role !== b.role ||
        p.pitchSlot !== b.pitchSlot ||
        p.avatarUrl !== b.avatarUrl ||
        p.posX !== b.posX ||
        p.posY !== b.posY
      );
    });
  }, [players, formationId, logoUrl, baseline]);

  function onDragStart(event: DragStartEvent) {
    if (!canEdit) return;
    setActiveId(String(event.active.id));
    setSelectedId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!canEdit) return;
    const { active, over, delta } = event;
    const draggedId = String(active.id);
    const dragged = players.find((p) => p.id === draggedId);
    if (!dragged) return;

    const overId = over ? String(over.id) : null;

    // Drop on bench → send starter to bench (swap with a sub)
    if (overId === "bench" && dragged.role === "STARTER") {
      setPlayers((prev) => {
        const next = prev.map((p) => ({ ...p }));
        const d = next.find((p) => p.id === draggedId)!;
        const firstSub = next.find((p) => p.role === "SUB");
        if (!firstSub) return prev;
        const slot = d.pitchSlot;
        const x = d.posX;
        const y = d.posY;
        d.role = "SUB";
        d.pitchSlot = null;
        d.posX = null;
        d.posY = null;
        firstSub.role = "STARTER";
        firstSub.pitchSlot = slot || "ST";
        firstSub.posX = x ?? 50;
        firstSub.posY = y ?? 40;
        return next;
      });
      return;
    }

    // Drop on another player card → swap
    if (overId?.startsWith("player:")) {
      const targetId = overId.replace("player:", "");
      if (targetId === draggedId) return;
      setPlayers((prev) => {
        const next = prev.map((p) => ({ ...p }));
        const d = next.find((p) => p.id === draggedId)!;
        const t = next.find((p) => p.id === targetId)!;
        if (d.role === "SUB" && t.role === "STARTER") {
          const slot = t.pitchSlot;
          const x = t.posX;
          const y = t.posY;
          t.role = "SUB";
          t.pitchSlot = null;
          t.posX = null;
          t.posY = null;
          d.role = "STARTER";
          d.pitchSlot = slot || "ST";
          d.posX = x ?? 50;
          d.posY = y ?? 40;
        } else if (d.role === "STARTER" && t.role === "STARTER") {
          const sx = d.posX;
          const sy = d.posY;
          const ss = d.pitchSlot;
          d.posX = t.posX;
          d.posY = t.posY;
          d.pitchSlot = t.pitchSlot;
          t.posX = sx;
          t.posY = sy;
          t.pitchSlot = ss;
        } else if (d.role === "STARTER" && t.role === "SUB") {
          const slot = d.pitchSlot;
          const x = d.posX;
          const y = d.posY;
          d.role = "SUB";
          d.pitchSlot = null;
          d.posX = null;
          d.posY = null;
          t.role = "STARTER";
          t.pitchSlot = slot || "ST";
          t.posX = x ?? 50;
          t.posY = y ?? 40;
        }
        return next;
      });
      return;
    }

    // Free move on pitch (or drop on pitch surface)
    if (dragged.role === "STARTER" && pitchRef.current) {
      const rect = pitchRef.current.getBoundingClientRect();
      const curX = dragged.posX ?? 50;
      const curY = dragged.posY ?? 50;
      const nextX = clampPitchPercent(curX + (delta.x / rect.width) * 100);
      const nextY = clampPitchPercent(curY + (delta.y / rect.height) * 100);
      setPlayers((prev) => {
        const next = prev.map((p) =>
          p.id === draggedId ? { ...p, posX: nextX, posY: nextY } : p,
        );
        const detected = detectFormationFromPositions(next);
        if (detected && detected !== "Custom") {
          setFormationId(detected);
        }
        return next;
      });
      return;
    }

    // Sub dropped onto empty pitch → bring on, park at pointer/delta from center
    if (dragged.role === "SUB" && overId === "pitch" && pitchRef.current) {
      const rect = pitchRef.current.getBoundingClientRect();
      let dropX = 50;
      let dropY = 40;
      const pe = event.activatorEvent as PointerEvent | undefined;
      if (pe && "clientX" in pe) {
        // Approximate using last known pointer via delta from card origin — use center bias
        dropX = clampPitchPercent(50 + (delta.x / rect.width) * 100);
        dropY = clampPitchPercent(35 + (delta.y / rect.height) * 100);
      }
      setPlayers((prev) => {
        const next = prev.map((p) => ({ ...p }));
        const d = next.find((p) => p.id === draggedId)!;
        const out = next
          .filter((p) => p.role === "STARTER")
          .sort((a, b) => b.sortOrder - a.sortOrder)[0];
        if (!out) return prev;
        out.role = "SUB";
        out.pitchSlot = null;
        out.posX = null;
        out.posY = null;
        d.role = "STARTER";
        d.pitchSlot = "ST";
        d.posX = dropX;
        d.posY = dropY;
        return next;
      });
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      if (canEdit && logoUrl !== initialLogo) {
        await fetch(`/api/teams/${teamId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl }),
        });
      }

      const res = await fetch("/api/players", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          // Always persist the live shape from free positioning
          formation: detectedFormation || formationId,
          players: players.map((p, i) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            pitchSlot: p.pitchSlot,
            avatarUrl: p.avatarUrl,
            posX: p.posX,
            posY: p.posY,
            sortOrder: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const savedFormation =
        data.formation ||
        data.detectedFormation ||
        detectFormationFromPositions(data.players);
      const nextFormation = savedFormation || formationId;
      const nextPlayers: Player[] = ensurePlayerCoords(
        data.players as Player[],
        getFormation(
          isPresetFormation(nextFormation)
            ? nextFormation
            : FORMATIONS[0]!.id,
        ),
      );
      setPlayers(nextPlayers);
      setFormationId(nextFormation);
      setBaseline({
        formationId: nextFormation,
        logoUrl: logoUrl ?? null,
        players: nextPlayers.map((p) => ({ ...p })),
      });
      setMessage(`Game plan saved · ${nextFormation}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const { setNodeRef: setPitchDropRef, isOver: pitchOver } = useDroppable({
    id: "pitch",
  });

  function setPitchNode(node: HTMLDivElement | null) {
    pitchRef.current = node;
    setPitchDropRef(node);
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/* Mobile header: crest + name + save */}
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a1610]/90 p-3 lg:hidden">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover ring-2 ring-white/20"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-xl font-bold text-white ring-2 ring-white/20">
              {teamName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-xl leading-none text-white">
              {teamName}
            </p>
            <p className="mt-1 truncate text-xs text-white/45">
              {displayFormation}
            </p>
            {managerName && (
              <div className="mt-2 flex items-center gap-2">
                {managerImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={managerImage}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-800 text-[10px] font-bold text-white">
                    {managerName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate text-xs font-medium text-white/75">
                  Manager · {managerName}
                </span>
              </div>
            )}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="shrink-0 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? "…" : "Save"}
            </button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
          <aside className="order-2 space-y-4 rounded-2xl border border-white/10 bg-[#0a1610]/90 p-4 lg:order-1">
            <div className="hidden flex-col items-center gap-3 text-center lg:flex">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-24 w-24 rounded-xl object-cover ring-2 ring-white/20"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-emerald-900 text-3xl font-bold text-white ring-2 ring-white/20">
                  {teamName.slice(0, 1)}
                </div>
              )}
              <div>
                <p className="font-display text-2xl leading-none text-white">
                  {teamName}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {managerName
                    ? `Manager · ${managerName}`
                    : "Culvert Football League squad"}
                </p>
              </div>
            </div>

            {managerName && (
              <div className="hidden lg:block">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                  {managerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={managerImage}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-white/15"
                    />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-900 text-sm font-bold text-white ring-2 ring-white/15">
                      {managerName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      Manager
                    </p>
                    <p className="truncate text-sm font-semibold text-white">
                      {managerName}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {canEdit && (
              <ImageUpload
                value={logoUrl}
                onChange={setLogoUrl}
                label="Change crest"
                round
              />
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Formation presets
                </p>
                {canEdit && isDirty && (
                  <button
                    type="button"
                    onClick={resetGamePlan}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/15"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-2">
                {FORMATIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={!canEdit}
                    title={f.blurb}
                    onClick={() => changeFormation(f.id)}
                    className={`rounded-lg px-2 py-2.5 text-sm font-semibold ${
                      formationId === f.id || displayFormation === f.id
                        ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                        : "bg-white/8 text-white/65 hover:bg-white/12"
                    } disabled:opacity-50`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Live shape
                </p>
                <p className="font-display text-2xl text-white">
                  {displayFormation}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-white/45">
                  {formationMeta?.blurb ??
                    "Updates automatically from free positioning (e.g. 1-3-1)."}
                </p>
              </div>
              {canEdit && isDirty && (
                <button
                  type="button"
                  onClick={resetGamePlan}
                  className="mt-3 w-full rounded-xl border border-amber-400/30 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                >
                  Reset formation & positions
                </button>
              )}
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="hidden w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-60 lg:block"
              >
                {saving ? "Saving…" : "Save game plan"}
              </button>
            )}
            {message && (
              <p className="text-center text-xs text-emerald-200/90">{message}</p>
            )}
          </aside>

          <div className="order-1 min-w-0 lg:order-2">
            <div
              ref={setPitchNode}
              className={`relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:max-w-xl ${
                pitchOver ? "border-sky-400/60" : "border-emerald-950/50"
              }`}
              style={{
                background: `
                  linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 12%, transparent 88%, rgba(0,0,0,0.35) 100%),
                  repeating-linear-gradient(
                    180deg,
                    #1f7a3a 0px,
                    #1f7a3a 48px,
                    #186832 48px,
                    #186832 96px
                  )
                `,
              }}
            >
              <div className="pointer-events-none absolute inset-3 rounded-lg border-2 border-white/40 sm:inset-4">
                <div className="absolute left-1/2 top-0 h-[14%] w-[38%] -translate-x-1/2 border-2 border-t-0 border-white/40" />
                <div className="absolute bottom-0 left-1/2 h-[14%] w-[38%] -translate-x-1/2 border-2 border-b-0 border-white/40" />
                <div className="absolute left-0 right-0 top-1/2 border-t-2 border-white/40" />
                <div className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
              </div>

              <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex items-start justify-between sm:left-4 sm:right-4 sm:top-3">
                <span className="rounded bg-black/45 px-2 py-0.5 font-display text-lg tracking-wide text-white shadow sm:px-2.5 sm:py-1 sm:text-xl">
                  {displayFormation}
                </span>
                <span className="rounded bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 sm:px-2.5 sm:py-1 sm:text-[11px]">
                  Free move
                </span>
              </div>

              {starters.map((player) => (
                <FreePlayer
                  key={player.id}
                  player={player}
                  canEdit={canEdit}
                  selected={selectedId === player.id}
                  onSelect={setSelectedId}
                />
              ))}
            </div>

            <p className="mt-3 px-1 text-center text-[11px] leading-snug text-white/40 sm:text-xs">
              {canEdit
                ? "Drag players on the pitch · tap a card to edit · drop on bench to sub"
                : "View only"}
            </p>

            <div className="mt-3">
              <Bench
                subs={subs}
                canEdit={canEdit}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>

          <aside className="order-3 space-y-4 rounded-2xl border border-white/10 bg-[#0a1610]/90 p-4 lg:order-3">
            <div className="flex items-end justify-between gap-3 lg:block">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Squad strength
                </p>
                <p className="font-display text-3xl text-white lg:text-4xl">
                  {players.length}
                  <span className="ml-1 text-base text-white/40 lg:text-lg">
                    players
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-white/40">
                  {starters.length}/{starterCount} starters · {subs.length}/
                  {subCount} subs
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 lg:hidden"
                >
                  {saving ? "Saving…" : "Save game plan"}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Selected player
              </p>
              {selected ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <PlayerCard
                      player={selected}
                      position={selected.pitchSlot || "SUB"}
                      selected
                    />
                  </div>
                  {canEdit ? (
                    <>
                      <label className="block text-xs text-white/60">
                        Name
                        <input
                          className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                          value={selected.name}
                          onChange={(e) =>
                            renamePlayer(selected.id, e.target.value)
                          }
                        />
                      </label>
                      {selected.role === "STARTER" && (
                        <label className="block text-xs text-white/60">
                          Position label
                          <select
                            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                            value={selected.pitchSlot || "ST"}
                            onChange={(e) =>
                              setRoleLabel(selected.id, e.target.value)
                            }
                          >
                            {ROLE_LABELS.filter((l) => l !== "SUB").map(
                              (label) => (
                                <option key={label} value={label}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      )}
                      <ImageUpload
                        value={selected.avatarUrl}
                        onChange={(url) => setAvatar(selected.id, url)}
                        label="Upload photo"
                        round
                      />
                    </>
                  ) : (
                    <p className="text-center text-sm text-white/70">
                      {selected.name}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-white/40">
                  Tap a player card on the pitch
                </p>
              )}
            </div>

            {canEdit && (
              <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/45">
                Tip: use a formation preset as a start, then drag freely like
                eFootball custom positioning.
              </p>
            )}
          </aside>
        </div>

        <DragOverlay dropAnimation={null}>
          {activePlayer ? (
            <PlayerCard
              player={activePlayer}
              position={activePlayer.pitchSlot || "SUB"}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function FreePlayer({
  player,
  canEdit,
  selected,
  onSelect,
}: {
  player: Player;
  canEdit: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `player:${player.id}`,
  });
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: player.id, disabled: !canEdit });

  function setRefs(node: HTMLDivElement | null) {
    setNodeRef(node);
    setDropRef(node);
  }

  const style = {
    left: `${player.posX ?? 50}%`,
    top: `${player.posY ?? 50}%`,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 touch-none ${
        isOver ? "scale-105" : ""
      }`}
      {...(canEdit ? { ...listeners, ...attributes } : {})}
      onClick={() => onSelect(player.id)}
    >
      <PlayerCard
        player={player}
        position={player.pitchSlot || "ST"}
        selected={selected}
      />
    </div>
  );
}

function Bench({
  subs,
  canEdit,
  selectedId,
  onSelect,
}: {
  subs: Player[];
  canEdit: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "bench" });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border border-white/10 bg-[#07140e]/90 p-4 ${
        isOver ? "ring-2 ring-emerald-400/70" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
          Substitutes
        </p>
        <p className="text-[10px] text-white/35">{subs.length} on bench</p>
      </div>
      <div className="flex flex-wrap gap-4">
        {subs.map((player) => (
          <BenchCard
            key={player.id}
            player={player}
            canEdit={canEdit}
            selected={selectedId === player.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function BenchCard({
  player,
  canEdit,
  selected,
  onSelect,
}: {
  player: Player;
  canEdit: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: `player:${player.id}`,
  });
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: player.id, disabled: !canEdit });

  function setRefs(node: HTMLDivElement | null) {
    setNodeRef(node);
    setDropRef(node);
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className="touch-none"
      {...(canEdit ? { ...listeners, ...attributes } : {})}
      onClick={() => onSelect(player.id)}
    >
      <PlayerCard player={player} position="SUB" selected={selected} />
    </div>
  );
}

function PlayerCard({
  player,
  position,
  selected,
  dragging,
}: {
  player: Player;
  position: string;
  selected?: boolean;
  dragging?: boolean;
}) {
  const initials = player.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const ovr = 70 + (player.name.length % 20);

  return (
    <div
      className={`relative flex h-[72px] w-[54px] flex-col overflow-hidden rounded-lg border bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] shadow-xl sm:h-[92px] sm:w-[68px] ${
        selected
          ? "border-sky-400 ring-2 ring-sky-400/50"
          : "border-white/20"
      } ${dragging ? "scale-110 shadow-2xl" : ""}`}
    >
      <div className="flex items-center justify-between px-1 pt-0.5 sm:pt-1">
        <span className="text-[8px] font-bold uppercase tracking-wide text-amber-300 sm:text-[9px]">
          {position}
        </span>
        <span className="text-[10px] font-black tabular-nums text-white sm:text-[11px]">
          {ovr}
        </span>
      </div>
      <div className="mx-auto mt-0.5 flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-white/10 sm:h-10 sm:w-10">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[10px] font-bold text-white/70 sm:text-[11px]">
            {initials}
          </span>
        )}
      </div>
      <div className="mt-auto truncate bg-black/50 px-0.5 py-0.5 text-center text-[8px] font-semibold text-white sm:px-1 sm:text-[9px]">
        {player.name}
      </div>
    </div>
  );
}
