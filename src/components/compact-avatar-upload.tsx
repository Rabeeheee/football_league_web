"use client";

import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/client-image";

type Props = {
  value?: string | null;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export function CompactAvatarUpload({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await fileToDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1">
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
      {error && <p className="text-[10px] text-red-300">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
