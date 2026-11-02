import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** Signs in to the demo's own tables rather than the real ledger. */
    demo?: boolean;
  }

  interface Session {
    user: { id: string; demo: boolean } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    demo?: boolean;
  }
}
