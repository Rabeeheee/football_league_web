import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveSignupRole } from "@/lib/assign-role";
import {
  Role,
  SIGNUP_INTENT_COOKIE,
  type Role as RoleType,
  type SignupIntent,
} from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: RoleType;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: RoleType;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: RoleType;
  }
}

const googleConfigured =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as RoleType,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const email = user.email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email } });

      let intent: SignupIntent = "visitor";
      try {
        const jar = await cookies();
        const raw = jar.get(SIGNUP_INTENT_COOKIE)?.value;
        if (raw === "admin" || raw === "visitor") intent = raw;
        // Clear after read so a later plain sign-in does not re-apply
        jar.delete(SIGNUP_INTENT_COOKIE);
      } catch {
        // cookies() may fail outside request context
      }

      if (existing) {
        const data: {
          name: string;
          image: string | null;
          role?: RoleType;
        } = {
          name: user.name || existing.name,
          image: user.image ?? existing.image,
        };

        // Existing accounts can still claim admin (e.g. first league admin
        // after wipe, or pending request). Never demote on visitor intent.
        if (
          intent === "admin" &&
          existing.role !== Role.LEAGUE_ADMIN
        ) {
          data.role = await resolveSignupRole("admin");
        }

        await prisma.user.update({
          where: { id: existing.id },
          data,
        });
      } else {
        const role = await resolveSignupRole(intent);
        await prisma.user.create({
          data: {
            email,
            name: user.name || email.split("@")[0],
            image: user.image ?? null,
            role,
            passwordHash: null,
          },
        });
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      // Always refresh role from DB when we have an email (approvals take effect)
      const email = (user?.email || token.email) as string | undefined;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role as RoleType;
          token.picture = dbUser.image ?? token.picture;
          token.name = dbUser.name;
          token.email = dbUser.email;
          return token;
        }
      }

      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      if (trigger === "update" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase().trim() },
        });
        if (dbUser) token.role = dbUser.role as RoleType;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        if (token.picture) session.user.image = String(token.picture);
      }
      return session;
    },
  },
};
