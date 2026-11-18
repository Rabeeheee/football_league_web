"use client";

import type { SignupIntent } from "@/lib/roles";

type Props = {
  value: SignupIntent;
  onChange: (value: SignupIntent) => void;
};

export function RoleIntentPicker({ value, onChange }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm text-white/70">I am joining as</legend>
      <div className="grid grid-cols-2 gap-2">
        <IntentCard
          active={value === "visitor"}
          title="Visitor"
          description="Browse teams, fixtures & standings"
          onClick={() => onChange("visitor")}
        />
        <IntentCard
          active={value === "admin"}
          title="Admin"
          description="First becomes league admin; others need approval"
          onClick={() => onChange("admin")}
        />
      </div>
    </fieldset>
  );
}

function IntentCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-emerald-400/60 bg-emerald-500/15 text-white"
          : "border-white/15 bg-black/30 text-white/70 hover:border-white/30"
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-[11px] leading-snug opacity-80">{description}</p>
    </button>
  );
}
