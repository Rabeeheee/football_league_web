"use client";

import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/client-image";

type Props = {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  round?: boolean;
  disabled?: boolean;
};

export function ImageUpload({
  value,
  onChange,
  label = "Upload image",
  round,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const url = await fileToDataUrl(file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className={`relative overflow-hidden border border-dashed border-white/25 bg-black/30 ${
            round ? "h-16 w-16 rounded-full" : "h-16 w-16 rounded-xl"
          } ${disabled ? "opacity-50" : "hover:border-emerald-400/50"}`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-white/40">+</span>
          )}
        </button>
        <div>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="text-sm text-emerald-300 hover:underline disabled:opacity-50"
          >
            {busy ? "Processing…" : label}
          </button>
          <p className="text-[11px] text-white/40">
            From gallery · auto-compressed · JPG/PNG/WEBP
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
