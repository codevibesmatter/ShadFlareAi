import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { withCloudflare } from 'better-auth-cloudflare';
import { anonymous, openAPI } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../database/auth.schema';
import type { Env } from '../../worker';
import { authLog } from '../../src/lib/logger';

const authLogger = authLog('server/auth/config.ts');

export function createAuth(env: Env, cf?: any) {
  // Use actual DB with schema for runtime
  const db = drizzle(env.DB, { schema, logger: true });
  
  return betterAuth({
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf || {},
        d1: {
          db,
          options: {
            usePlural: true,
            debugLogs: true,
          },
        },
        kv: env.SESSIONS,
      },
      {
        emailAndPassword: {
          enabled: true,
        },
        plugins: [anonymous(), openAPI()],
        rateLimit: {
          enabled: true,
        },
        secret: env.BETTER_AUTH_SECRET || 'default-dev-secret-change-in-production',
        baseUrl: env.BETTER_AUTH_URL || 'http://localhost:5173',
        
        // Use Better Auth's native session management - no custom hooks needed
        
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
      }
    ),
  });
}