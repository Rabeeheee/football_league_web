import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      passwordHash: true,
      managedTeam: { select: { id: true, name: true } },
    },
  });

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-lg px-3 py-8 sm:px-4 sm:py-12">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-white sm:text-4xl">
            Manage profile
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Update your name, photo, and password.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm text-white/45 hover:text-white/70"
        >
          Back
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0a1610]/90 p-4 sm:p-6">
        <ProfileForm
          initial={{
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            hasPassword: !!user.passwordHash,
            managedTeam: user.managedTeam,
          }}
        />
      </div>
    </main>
  );
}
