import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Role } from "@/lib/roles";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireRole(roles: Role[]) {
  const session = await getSession();
  if (!session?.user || !roles.includes(session.user.role)) {
    return null;
  }
  return session;
}
