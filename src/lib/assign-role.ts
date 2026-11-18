import { prisma } from "@/lib/prisma";
import { Role, type SignupIntent } from "@/lib/roles";

/** First admin request becomes LEAGUE_ADMIN; later ones wait for approval. */
export async function resolveSignupRole(intent: SignupIntent): Promise<Role> {
  if (intent !== "admin") return Role.VISITOR;

  const leagueAdminCount = await prisma.user.count({
    where: { role: Role.LEAGUE_ADMIN },
  });

  if (leagueAdminCount === 0) return Role.LEAGUE_ADMIN;
  return Role.PENDING_ADMIN;
}
