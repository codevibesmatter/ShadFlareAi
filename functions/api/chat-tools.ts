import { runWithTools } from '@cloudflare/ai-utils';
import { requireAuth } from '../../server/middleware/auth';
import type { Env } from '../../worker';

// Define useful tools for the AI assistant
const tools = {
  // Simple calculator tool
  calculate: {
    description: "Performs basic mathematical calculations. Supports operations: +, -, *, /",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The mathematical expression to evaluate (e.g., '2 + 3 * 4')"
        }
      },
      required: ["expression"]
    },
    function: async ({ expression }: { expression: string }) => {
      try {
        // Basic safety check - only allow numbers, operators, spaces, and parentheses
        if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
          return { error: "Invalid expression. Only numbers and basic operators (+, -, *, /, parentheses) are allowed." };
        }
        
        // Evaluate the expression safely
        const result = Function('"use strict"; return (' + expression + ')')();
        
        if (typeof result !== 'number' || !isFinite(result)) {
          return { error: "Invalid mathematical expression" };
        }
        
        return { result };
      } catch (error) {
        return { error: "Failed to evaluate expression" };
      }
    }
  },

  // Get current time
  getCurrentTime: {
    description: "Gets the current date and time",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "The timezone to get the time for (e.g., 'UTC', 'America/New_York')",
          default: "UTC"
        }
      }
    },
    function: async ({ timezone = 'UTC' }: { timezone?: string }) => {
      try {
        const now = new Date();
        const timeString = now.toLocaleString('en-US', { 
          timeZone: timezone,
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        return { 
          time: timeString,
          timezone,
          timestamp: now.toISOString()
        };
      } catch (error) {
        return { error: "Failed to get current time" };
      }
    }
  },

  // Generate random number
  generateRandomNumber: {
    description: "Generates a random number within a specified range",
    parameters: {
      type: "object",
      properties: {
        min: {
          type: "number",
          description: "The minimum value (inclusive)"
        },
        max: {
          type: "number", 
          description: "The maximum value (inclusive)"
        },
        count: {
          type: "number",
          description: "How many random numbers to generate",
          default: 1
        }
      },
      required: ["min", "max"]
    },
    function: async ({ min, max, count = 1 }: { min: number; max: number; count?: number }) => {
      try {
        if (min > max) {
          return { error: "Minimum value cannot be greater than maximum value" };
        }
        
        if (count < 1 || count > 100) {
          return { error: "Count must be between 1 and 100" };
        }
        
        const numbers = [];
        for (let i = 0; i < count; i++) {
          const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
          numbers.push(randomNum);
        }
        
        return { 
          numbers: count === 1 ? numbers[0] : numbers,
          range: { min, max },
          count 
        };
      } catch (error) {
        return { error: "Failed to generate random number" };
      }
    }
  },

  // Create a simple task/reminder
  createTask: {
    description: "Creates a simple task or reminder note",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The task title or summary"
        },
        description: {
          type: "string",
          description: "Detailed description of the task (optional)"
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Task priority level",
          default: "medium"
        }
      },
      required: ["title"]
    },
    function: async ({ title, description, priority = 'medium' }: { 
      title: string; 
      description?: string; 
      priority?: string 
    }) => {
      // In a real implementation, this would save to a database
      const task = {
        id: crypto.randomUUID(),
        title,
        description: description || null,
        priority,
        created: new Date().toISOString(),
        completed: false
      };
      
      return { 
        message: "Task created successfully!",
        task 
      };
    }
  }
};

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
    
    // Check if AI is available
    if (!context.env.AI) {
      return new Response(JSON.stringify({ 
        error: 'AI service not configured. Please configure AI binding in wrangler.toml' 
      }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Use embedded function calling with Hermes 2 Pro
    const result = await runWithTools(
      context.env.AI,
      '@hf/nousresearch/hermes-2-pro-mistral-7b',
      messages,
      tools
    );
    
    return new Response(JSON.stringify({
      role: 'assistant',
      content: result.response
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Chat tools error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process chat request with tools' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}