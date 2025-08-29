import { createAuth } from '../../../server/auth/config';
import type { Env } from '../../../worker';

export async function onRequest(context: { 
  request: Request; 
  env: Env; 
  params: { route?: string[] };
}) {
  const auth = createAuth(context.env);
  
  // Handle all auth routes
  return auth.handler(context.request);
}