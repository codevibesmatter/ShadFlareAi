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
        
        // Session hooks for WebSocket broadcast
        databaseHooks: {
          session: {
            delete: {
              after: async (session) => {
                try {
                  authLogger.info('Session deleted via Better Auth hook', { userId: session.userId });
                  
                  // Broadcast session invalidation to UserSysDO
                  if (session.userId && env.USER_SYS_DO) {
                    const id = env.USER_SYS_DO.idFromName(`user-${session.userId}`);
                    const stub = env.USER_SYS_DO.get(id);
                    
                    await stub.fetch(new Request(`http://localhost/broadcast`, {
                      method: 'POST',
                      body: JSON.stringify({
                        type: 'session-invalidated',
                        userId: session.userId,
                        reason: 'session_deleted',
                        timestamp: Date.now()
                      }),
                      headers: { 'Content-Type': 'application/json' }
                    }));
                    
                    authLogger.info('Broadcasted session invalidation', { userId: session.userId });
                  }
                } catch (error) {
                  authLogger.error('Failed to broadcast session invalidation', error);
                }
              }
            }
          }
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
      }
    ),
  });
}