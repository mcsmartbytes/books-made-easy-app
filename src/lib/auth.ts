import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

// Lazy-load SQL connection to avoid build-time errors
function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Email/Password login
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const sql = getSql();
          const users = await sql`
            SELECT id, email, password_hash, name, business_name
            FROM users
            WHERE email = ${credentials.email}
          `;

          const user = users[0];
          if (!user || !user.password_hash) {
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password_hash);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            businessName: user.business_name,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
    // Google OAuth (optional - configure in Google Cloud Console)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.businessName = (user as any).businessName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).businessName = token.businessName;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth providers, create/update user in database
      if (account?.provider !== 'credentials' && user.email) {
        try {
          const sql = getSql();
          const existingUsers = await sql`
            SELECT id FROM users WHERE email = ${user.email}
          `;

          if (existingUsers.length === 0) {
            await sql`
              INSERT INTO users (email, name, created_at)
              VALUES (${user.email}, ${user.name}, NOW())
            `;
          }
        } catch (error) {
          console.error('Error creating OAuth user:', error);
        }
      }
      return true;
    },
  },
};
