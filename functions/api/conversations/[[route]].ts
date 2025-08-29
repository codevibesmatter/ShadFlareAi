import { requireAuth } from '../../../server/middleware/auth';
import type { Env } from '../../../worker';

// GET /api/conversations - List user's conversations
export async function onRequestGet(context: { 
  request: Request; 
  env: Env;
  params: { route?: string[] };
}) {
  const authResponse = await requireAuth({
    req: context.request,
    env: context.env,
    json: (data: any, status?: number) => new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }),
    set: () => {},
    get: (key: string) => {
      if (key === 'user') return { id: 'user-id' }; // This will be set by requireAuth
    }
  } as any);
  
  if (authResponse) return authResponse;
  
  const route = context.params.route;
  
  // Get specific conversation
  if (route && route[0]) {
    const conversationId = route[0];
    
    if (route[1] === 'messages') {
      // Get messages for conversation
      const result = await context.env.DB.prepare(
        `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
      ).bind(conversationId).all();
      
      return new Response(JSON.stringify(result.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get conversation details
    const result = await context.env.DB.prepare(
      `SELECT * FROM conversations WHERE id = ?`
    ).bind(conversationId).first();
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // List all conversations for user
  const userId = 'user-id'; // This should come from auth context
  const result = await context.env.DB.prepare(
    `SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC`
  ).bind(userId).all();
  
  return new Response(JSON.stringify(result.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// POST /api/conversations - Create new conversation
export async function onRequestPost(context: { 
  request: Request; 
  env: Env;
}) {
  const authResponse = await requireAuth({
    req: context.request,
    env: context.env,
    json: (data: any, status?: number) => new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }),
    set: () => {},
    get: (key: string) => {
      if (key === 'user') return { id: 'user-id' };
    }
  } as any);
  
  if (authResponse) return authResponse;
  
  const { title, model = 'llama-3-8b', systemPrompt } = await context.request.json();
  const userId = 'user-id'; // This should come from auth context
  const id = crypto.randomUUID();
  
  await context.env.DB.prepare(
    `INSERT INTO conversations (id, user_id, title, model, system_prompt) 
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, userId, title || 'New Conversation', model, systemPrompt || null).run();
  
  return new Response(JSON.stringify({ id, title, model }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

// DELETE /api/conversations/:id - Delete conversation
export async function onRequestDelete(context: { 
  request: Request; 
  env: Env;
  params: { route?: string[] };
}) {
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
  
  const conversationId = context.params.route?.[0];
  
  if (!conversationId) {
    return new Response(JSON.stringify({ error: 'Conversation ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  await context.env.DB.prepare(
    `DELETE FROM conversations WHERE id = ?`
  ).bind(conversationId).run();
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}