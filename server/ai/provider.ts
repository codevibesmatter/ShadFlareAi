import { createProvider } from 'ai';
import { AI_MODELS, type ChatModel } from './models';
import { aiLog } from '../../src/lib/logger';

const aiLogger = aiLog('server/ai/provider.ts');

export function createCloudflareProvider(ai: Ai) {
  return createProvider({
    async complete({ model, messages, temperature = 0.7, maxTokens = 2048 }) {
      try {
        const response = await ai.run(model, {
          messages,
          stream: true,
          max_tokens: maxTokens,
          temperature,
        });
        
        return {
          stream: response.stream(),
          usage: async () => ({
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0,
          }),
        };
      } catch (error) {
        aiLogger.error('AI provider error', error);
        throw new Error('Failed to generate response');
      }
    },
  });
}

export async function generateEmbedding(
  ai: Ai, 
  text: string, 
  model: keyof typeof AI_MODELS.embeddings = 'bge-base'
) {
  try {
    const response = await ai.run(AI_MODELS.embeddings[model], {
      text: [text],
    });
    
    return response.data?.[0] || null;
  } catch (error) {
    aiLogger.error('Embedding generation error', error);
    return null;
  }
}