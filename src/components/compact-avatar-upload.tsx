"use client";

import { useRef, useState } from "react";

type Props = {
  value?: string | null;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function CompactAvatarUpload({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch {
      // silent — parent save flow will surface issues if needed
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        title="Upload photo from gallery"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-emerald-200 hover:bg-black/70 disabled:opacity-50"
      >
        {busy ? "…" : value ? "Change photo" : "Add photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </>
  );
}
