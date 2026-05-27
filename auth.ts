import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { EmailConfig } from "next-auth/providers/email";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

/**
 * Custom "manual link" provider.
 *
 * Acts like an email magic-link provider so NextAuth's callback handler
 * (`/api/auth/callback/link?token=...&email=...`) works as usual — but
 * `sendVerificationRequest` is a no-op because the admin shares the link
 * out-of-band (WhatsApp, email, paper plane…).
 *
 * Links are generated explicitly from `/admin/users` or from the
 * `npm run admin:link <email>` CLI; nothing is auto-sent.
 */
const ManualLinkProvider: EmailConfig = {
  id: "link",
  name: "Manual link",
  type: "email",
  from: "noreply@rfedi-delivery.local",
  maxAge: 24 * 60 * 60, // 24h
  options: {},
  server: {},
  sendVerificationRequest: async ({ url, identifier }) => {
    // No email is sent. We log so the URL is recoverable from server
    // logs as a last-resort recovery channel.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[auth] magic link for ${identifier}: ${url}`);
    }
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 180 * 24 * 60 * 60 },
  providers: [ManualLinkProvider],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request",
    error: "/login/error",
  },
  callbacks: {
    async signIn({ user }) {
      // Invite-only: the email must already exist in the User table.
      // Admins create the row from /admin/users before sharing the link.
      if (!user?.email) return false;
      const existing = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { id: true },
      });
      return Boolean(existing);
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = (user as { role: Role }).role;
      return session;
    },
  },
});
