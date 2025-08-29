// Mock API for development - simulates Cloudflare AI responses
export async function mockChatCompletion(messages: any[], model: string = 'llama-3-8b') {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  const lastMessage = messages[messages.length - 1]?.content || ''
  
  // Simple mock responses based on model
  const responses = {
    'llama-3-8b': `I'm Llama 3 8B responding to: "${lastMessage}". This is a mock response for development. The actual implementation will use Cloudflare AI Workers.`,
    'mistral-7b': `Mistral 7B here! You said: "${lastMessage}". This is a development mock - real responses will come from Cloudflare AI.`,
    'qwen-1.5': `Qwen 1.5 14B processing: "${lastMessage}". Mock response active - production will use Cloudflare Workers API.`,
    'codellama': `CodeLlama analyzing: "${lastMessage}". Development mock active - will integrate with Cloudflare AI in production.`
  }
  
  return {
    id: `mock-${Date.now()}`,
    role: 'assistant',
    content: responses[model as keyof typeof responses] || responses['llama-3-8b']
  }
}