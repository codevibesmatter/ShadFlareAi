import { requireAuth } from '../../server/middleware/auth';
import type { Env } from '../../worker';

export async function onRequestPost(context: { 
  request: Request; 
  env: Env;
}) {
  // Check authentication
  const authResponse = await requireAuth({
    req: context.request,
    env: context.env,
    json: (data: any, status?: number) => new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }),
    set: () => {},
  } as any);
  
  if (authResponse) return authResponse;
  
  try {
    const { messages } = await context.request.json();
    
    // Simple test response to verify the endpoint works
    return new Response(JSON.stringify({
      role: 'assistant',
      content: 'Function calling endpoint is working! This is a test response. Received message: ' + messages[messages.length - 1]?.content
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Chat tools test error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process test request: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}