import { streamText } from 'ai';
import { createCloudflareProvider } from '../../server/ai/provider';
import { AI_MODELS } from '../../server/ai/models';
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
    const { messages, model = 'llama-3-8b', conversationId } = await context.request.json();
    
    // Check if AI is available
    if (!context.env.AI) {
      return new Response(JSON.stringify({ 
        error: 'AI service not configured. Please configure AI binding in wrangler.toml' 
      }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate model
    if (!AI_MODELS.chat[model as keyof typeof AI_MODELS.chat]) {
      return new Response(JSON.stringify({ error: 'Invalid model' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Initialize AI provider
    const provider = createCloudflareProvider(context.env.AI);
    
    // Generate response
    const result = await streamText({
      model: provider(AI_MODELS.chat[model as keyof typeof AI_MODELS.chat]),
      messages,
      temperature: 0.7,
      maxTokens: 2048,
      onFinish: async ({ text, usage }) => {
        // Store message in D1 if conversationId is provided
        if (conversationId) {
          try {
            await context.env.DB.prepare(
              `INSERT INTO messages (id, conversation_id, role, content, model, tokens_used) 
               VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(),
              conversationId,
              'assistant',
              text,
              model,
              usage?.totalTokens || 0
            ).run();
            
            // Update conversation
            await context.env.DB.prepare(
              `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`
            ).bind(conversationId).run();
          } catch (error) {
            console.error('Failed to store message:', error);
          }
        }
      },
    });
    
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process chat request' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}