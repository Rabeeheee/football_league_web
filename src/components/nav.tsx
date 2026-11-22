"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ORGANIZER } from "@/lib/organizer";

const links = [
  { href: "/", label: "Home", short: "Home" },
  { href: "/teams", label: "Teams", short: "Teams" },
  { href: "/fixtures", label: "Fixtures", short: "Fixtures" },
  { href: "/standings", label: "Standings", short: "Table" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1f14]/95 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 text-[#e8f5e9]"
          >
            <Image
              src={ORGANIZER.logoSrc}
              alt={ORGANIZER.fullName}
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain"
              priority
            />
            <span className="min-w-0">
              <span className="font-display block truncate text-base leading-none tracking-wide sm:text-lg">
                Culvert Football League
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-white/45">
                by {ORGANIZER.name}
              </span>
            </span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded px-3 py-1.5 transition ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {role === "LEAGUE_ADMIN" && (
              <Link
                href="/admin"
                className={`rounded px-3 py-1.5 transition ${
                  pathname.startsWith("/admin")
                    ? "bg-emerald-500/30 text-emerald-100"
                    : "text-emerald-200/80 hover:bg-emerald-500/20"
                }`}
              >
                Admin
              </Link>
            )}
            {role === "PENDING_ADMIN" && (
              <Link
                href="/pending-admin"
                className="rounded px-3 py-1.5 text-amber-200/90 hover:bg-amber-500/20"
              >
                Pending
              </Link>
            )}
            {session ? (
              <>
                <Link
                  href="/profile"
                  className={`rounded px-3 py-1.5 transition ${
                    pathname.startsWith("/profile")
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="ml-1 rounded px-3 py-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="ml-1 rounded bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500"
              >
                Sign in
              </Link>
            )}
          </nav>

          {/* Mobile: account + menu */}
          <div className="flex items-center gap-2 md:hidden">
            {session ? (
              <Link
                href="/profile"
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  pathname.startsWith("/profile")
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10"
                }`}
              >
                Profile
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                Sign in
              </Link>
            )}
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white"
            >
              <span className="sr-only">Menu</span>
              <div className="flex w-5 flex-col gap-1.5">
                <span
                  className={`h-0.5 w-full rounded bg-white transition ${
                    open ? "translate-y-2 rotate-45" : ""
                  }`}
                />
                <span
                  className={`h-0.5 w-full rounded bg-white transition ${
                    open ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`h-0.5 w-full rounded bg-white transition ${
                    open ? "-translate-y-2 -rotate-45" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-white/10 bg-[#0b1f14] px-3 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {links.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-xl px-4 py-3 text-base font-medium ${
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/75 active:bg-white/10"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {role === "LEAGUE_ADMIN" && (
                <Link
                  href="/admin"
                  className={`rounded-xl px-4 py-3 text-base font-medium ${
                    pathname.startsWith("/admin")
                      ? "bg-emerald-500/30 text-emerald-100"
                      : "text-emerald-200/90"
                  }`}
                >
                  Admin
                </Link>
              )}
              {role === "PENDING_ADMIN" && (
                <Link
                  href="/pending-admin"
                  className="rounded-xl px-4 py-3 text-base font-medium text-amber-200/90"
                >
                  Pending approval
                </Link>
              )}
              {session && (
                <>
                  <Link
                    href="/profile"
                    className={`rounded-xl px-4 py-3 text-base font-medium ${
                      pathname.startsWith("/profile")
                        ? "bg-white/15 text-white"
                        : "text-white/75 active:bg-white/10"
                    }`}
                  >
                    Manage profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-xl px-4 py-3 text-left text-base font-medium text-white/55 active:bg-white/10"
                  >
                    Sign out
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile bottom tabs — thumb-friendly */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b1f14]/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4 gap-0.5 px-1 pt-1.5">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-semibold ${
                    active
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "text-white/50"
                  }`}
                >
                  <TabIcon href={link.href} active={active} />
                  {link.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function TabIcon({ href, active }: { href: string; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (href === "/") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    );
  }
  if (href === "/teams") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5S14 16 14.8 19" />
        <path d="M14 14.5c1.6-.4 3.2.1 4.5 1.8.4.6.7 1.3.9 2.2" />
      </svg>
    );
  }
  if (href === "/fixtures") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M9 5v15M15 5v15" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 19V9l3 2 3-4 3 3 5-6" />
      <path d="M4 20h16" />
    </svg>
  );
}
