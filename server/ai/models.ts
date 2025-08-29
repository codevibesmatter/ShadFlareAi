export const AI_MODELS = {
  chat: {
    'llama-3-8b': '@cf/meta/llama-3-8b-instruct',
    'llama-2-7b': '@cf/meta/llama-2-7b-chat-int8',
    'mistral-7b': '@cf/mistral/mistral-7b-instruct-v0.1',
    'qwen-1.5': '@cf/qwen/qwen1.5-14b-chat-awq',
    'hermes-2-pro': '@hf/nousresearch/hermes-2-pro-mistral-7b',
    'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite', // Via AI Gateway
  },
  embeddings: {
    'bge-base': '@cf/baai/bge-base-en-v1.5',
    'bge-small': '@cf/baai/bge-small-en-v1.5',
  },
  code: {
    'codellama': '@cf/meta/codellama-7b-instruct-awq',
    'deepseek': '@cf/deepseek-ai/deepseek-coder-6.7b-instruct-awq',
  }
} as const;

export type ChatModel = keyof typeof AI_MODELS.chat;
export type EmbeddingModel = keyof typeof AI_MODELS.embeddings;
export type CodeModel = keyof typeof AI_MODELS.code;