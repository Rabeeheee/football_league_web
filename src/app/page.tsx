import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ORGANIZER } from "@/lib/organizer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tournament = await prisma.tournament.findFirst({
    include: { _count: { select: { teams: true } } },
  });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: "Culvert Football League",
        teamSlots: 8,
        entryFee: 100,
        starterCount: 5,
        subCount: 2,
      },
      include: { _count: { select: { teams: true } } },
    });
  }

  return (
    <main>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(180deg, transparent, #07140e), repeating-linear-gradient(90deg, transparent, transparent 40px, #14532d22 40px, #14532d22 41px), linear-gradient(180deg, #166534 0%, #14532d 50%, #052e16 100%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[62vh] max-w-6xl flex-col justify-end px-4 pb-10 pt-14 sm:min-h-[70vh] sm:pb-16 sm:pt-24">
          <div className="mb-4 flex items-center gap-3">
            <Image
              src={ORGANIZER.logoSrc}
              alt={ORGANIZER.fullName}
              width={56}
              height={56}
              className="h-12 w-12 object-contain sm:h-14 sm:w-14"
              priority
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Organised by
              </p>
              <p className="font-display text-xl leading-none text-white sm:text-2xl">
                {ORGANIZER.name}
              </p>
              <p className="mt-0.5 text-xs text-white/50">
                arts & sports club · {ORGANIZER.place}
              </p>
            </div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300/80 sm:text-sm sm:tracking-[0.3em]">
            Local turf · home football league
          </p>
          <h1 className="font-display mt-2 max-w-3xl text-[2.75rem] leading-[0.95] text-white sm:mt-3 sm:text-7xl md:text-8xl">
            {tournament.name}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/70 sm:mt-4 sm:text-lg">
            Browse every team on the pitch, follow the league fixtures, and
            check the points table. Team managers edit their own squad —{" "}
            {tournament.starterCount} starters and {tournament.subCount}{" "}
            substitutes.
          </p>
          <div className="mt-5 inline-flex w-full max-w-sm flex-wrap items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-amber-100 sm:mt-6 sm:w-fit sm:rounded-full sm:gap-3 sm:px-5 sm:py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/80 sm:text-xs">
              Entry fee
            </span>
            <span className="font-display text-3xl leading-none">
              ₹{tournament.entryFee}
            </span>
            <span className="text-sm text-amber-100/70">
              per person · pay offline
            </span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:gap-3">
            <Link
              href="/teams"
              className="rounded-xl bg-emerald-500 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-400 sm:rounded-lg sm:py-2.5"
            >
              View teams
            </Link>
            <Link
              href="/fixtures"
              className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/10 sm:rounded-lg sm:py-2.5"
            >
              Fixtures
            </Link>
            <Link
              href="/standings"
              className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-white/10 sm:rounded-lg sm:py-2.5"
            >
              Points table
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-3 px-4 py-8 sm:grid-cols-3 sm:gap-4 sm:py-12">
        <Stat
          label="Teams registered"
          value={`${tournament._count.teams} / ${tournament.teamSlots}`}
        />
        <Stat
          label="Squad size"
          value={`${tournament.starterCount} + ${tournament.subCount}`}
        />
        <Stat
          label="Entry fee"
          value={`₹${tournament.entryFee}`}
          hint="Per person"
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 sm:pb-16">
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 sm:px-6 sm:py-8">
          <h2 className="font-display text-xl text-white sm:text-2xl">
            How the points table works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            League phase builds the points table (every team plays every other).
            When that is finished, top teams go to knockout.
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-white/75 sm:grid-cols-2 sm:gap-3">
            <li className="rounded-xl bg-white/5 px-4 py-3">
              <span className="font-semibold text-emerald-300">Win</span> — 3
              points
            </li>
            <li className="rounded-xl bg-white/5 px-4 py-3">
              <span className="font-semibold text-sky-300">Draw</span> — 1 point
              each
            </li>
            <li className="rounded-xl bg-white/5 px-4 py-3">
              <span className="font-semibold text-white/90">Loss</span> — 0 points
            </li>
            <li className="rounded-xl bg-white/5 px-4 py-3">
              <span className="font-semibold text-amber-200">Tie-break</span> —
              Pts, then GD, then GF
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-white/45">
            Columns: P played · W wins · D draws · L losses · GF goals for · GA
            goals against · GD goal difference (GF − GA) · Pts total points.
          </p>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 sm:px-5 sm:py-6">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 sm:text-xs">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl text-white sm:mt-2 sm:text-4xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-white/45">{hint}</p> : null}
    </div>
  );
}
