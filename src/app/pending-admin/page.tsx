import Link from "next/link";
import { getSession } from "@/lib/session";
import { Role } from "@/lib/roles";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PendingAdminPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === Role.LEAGUE_ADMIN) redirect("/admin");
  if (session.user.role !== Role.PENDING_ADMIN) redirect("/");

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-12 text-center">
      <h1 className="font-display text-3xl text-white">Admin request pending</h1>
      <p className="mt-3 text-white/60">
        A league admin already exists. Your request must be approved before you
        get admin access. You can still browse the league as a visitor meanwhile.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex justify-center rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-white hover:bg-emerald-400"
      >
        Go to home
      </Link>
    </main>
  );
}
