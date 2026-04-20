import { getServerSession } from 'next-auth/next'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import prisma from './prisma'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt' as const,
  },
  callbacks: {
    jwt: async ({ token, user }: { token: { sub?: string; id?: string }, user?: { id: string } }) => {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session: async ({ session, token }: { session: { user?: { id?: string; name?: string | null; email?: string | null; image?: string | null }; expires: string }; token: { id?: string } }) => {
      if (session?.user) {
        session.user.id = token.id
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
}

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    return null
  }
  return session
}
