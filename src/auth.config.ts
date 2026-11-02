import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the auth setup: no Prisma, no bcrypt, so it can run in
 * middleware. The Credentials provider lives in src/auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.demo = user.demo === true;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      // Which tables the request may touch rides on the signed token, so it
      // cannot be forged by a query string or a form field.
      session.user.demo = token.demo === true;
      return session;
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
