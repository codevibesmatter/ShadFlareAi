import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import type { Env } from '../../worker';

export function createAuth(env: Env) {
  const db = drizzle(env.DB);
  
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'd1'
    }),
    
    emailAndPassword: {
      enabled: true
    },
    
    socialProviders: {
      google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      } : undefined,
      github: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET
      } : undefined,
    },
    
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: env.BETTER_AUTH_URL,
    
    callbacks: {
      onSignIn: async ({ user, session }) => {
        // Log sign-in event
        console.log(`User ${user.id} signed in at ${new Date().toISOString()}`);
        return { user, session };
      },
      onSignOut: async ({ user }) => {
        // Log sign-out event
        console.log(`User ${user.id} signed out at ${new Date().toISOString()}`);
      }
    }
  });
}