import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique database ID */
      id: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email?: string | null
    name?: string | null
    image?: string | null
    entraTokens?: {
      accessToken: string
      refreshToken: string
      expiresAt: number
    }
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** The user's unique database ID */
    id: string
    accessToken?: string
    refreshToken?: string
  }
}