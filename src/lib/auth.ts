import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { sql } from './db';

export const authOptions: NextAuthOptions = {
  providers: [
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
          const users = await sql`
            SELECT id, email, password_hash, name, business_name
            FROM users
            WHERE email = ${credentials.email}
          `;

          const user = users[0];
          if (!user || !user.password_hash) {
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, String(user.password_hash));
          if (!isValid) {
            return null;
          }

          return {
            id: String(user.id),
            email: String(user.email),
            name: user.name ? String(user.name) : null,
            businessName: user.business_name ? String(user.business_name) : null,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
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
      if (account?.provider !== 'credentials' && user.email) {
        try {
          const existingUsers = await sql`
            SELECT id FROM users WHERE email = ${user.email}
          `;

          if (existingUsers.length === 0) {
            const id = crypto.randomUUID();
            await sql`
              INSERT INTO users (id, email, name, created_at)
              VALUES (${id}, ${user.email}, ${user.name}, ${new Date().toISOString()})
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
