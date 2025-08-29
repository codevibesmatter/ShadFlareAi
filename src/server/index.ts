import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamText } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
// import { runWithTools } from '@cloudflare/ai-utils'

// Cloudflare Workers type definitions
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first(): Promise<unknown>;
  all(): Promise<D1Result>;
  run(): Promise<D1Result>;
}

interface D1Result {
  results?: unknown[];
  success: boolean;
  meta: unknown;
}

interface Ai {
  run(model: string, options: Record<string, unknown>): Promise<unknown>;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  DB: D1Database;
  AI?: Ai;
  KV: KVNamespace;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_API_KEY?: string;
  AI_GATEWAY_URL?: string;
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

// Chat API endpoint
app.post('/api/chat', async (c) => {
  try {
    const { messages, model = 'llama-3-8b' } = await c.req.json()

    console.log('Chat request for model:', model)
    console.log('Messages:', messages)

    // Handle Gemini via AI Gateway
    if (model === 'gemini-2.5-flash-lite') {
      if (!c.env.GOOGLE_API_KEY) {
        return c.json({ error: 'Google API key not configured' }, 500)
      }

      // Use AI Gateway URL if configured, otherwise direct Google API
      const baseUrl = c.env.AI_GATEWAY_URL || 'https://generativelanguage.googleapis.com'
      const apiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=${c.env.GOOGLE_API_KEY}`

      // Convert messages to Gemini format
      const geminiMessages = messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))

      // For now, let's use non-streaming to debug the issue
      const geminiResponse = await fetch(apiUrl.replace(':streamGenerateContent', ':generateContent'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      })

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text()
        console.error('Gemini API error:', errorText)
        return c.json({ error: 'Failed to call Gemini API: ' + errorText }, 500)
      }

      const geminiData: any = await geminiResponse.json()
      console.log('Gemini response:', geminiData)
      
      // Extract the text from the response
      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received'
      
      // Create a simple streaming response to match the expected format
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          
          try {
            // Send the complete response as a single chunk
            const chunk = `data: ${JSON.stringify({
              id: `gemini-${Date.now()}`,
              choices: [{
                delta: { content: responseText }
              }]
            })}\n\n`
            controller.enqueue(encoder.encode(chunk))
            
            // Send done signal
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            console.error('Stream error:', error)
            controller.error(error)
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Handle Cloudflare Workers AI models
    if (!c.env.AI) {
      return c.json({ error: 'AI binding not available in development environment' }, 500)
    }

    // Create Workers AI provider
    const workersai = createWorkersAI({
      binding: c.env.AI as any,
    })

    // Map model names to Cloudflare AI model IDs
    const modelMap = {
      'llama-3-8b': '@cf/meta/llama-3-8b-instruct',
      'mistral-7b': '@cf/mistral/mistral-7b-instruct-v0.1',
      'qwen-1.5': '@cf/qwen/qwen1.5-14b-chat-awq',
      codellama: '@cf/meta/code-llama-7b-instruct-awq',
      'hermes-2-pro': '@hf/nousresearch/hermes-2-pro-mistral-7b',
    }

    const modelId = modelMap[model as keyof typeof modelMap] || modelMap['llama-3-8b']

    console.log('Using AI SDK with model:', modelId)

    // Use AI SDK with Workers AI provider
    const result = await streamText({
      model: workersai(modelId),
      messages: messages,
      temperature: 0.7,
      maxTokens: 500,
    })

    console.log('AI SDK streamText result created')
    
    // Convert AI SDK stream to OpenAI-compatible format for frontend
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          for await (const chunk of result.textStream) {
            const data = `data: ${JSON.stringify({
              id: `cf-${Date.now()}`,
              choices: [
                {
                  delta: {
                    content: chunk,
                  },
                },
              ],
            })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
          
          // Send final chunk
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return c.json({ error: 'Failed to process chat request' }, 500)
  }
})

// Define tools for function calling
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

// Function calling chat endpoint - temporarily disabled due to import issues
/*
app.post('/api/chat-tools', async (c) => {
  try {
    const { messages } = await c.req.json()

    console.log('Function calling endpoint called with messages:', messages)
    
    // Check if AI binding is available
    if (!c.env.AI) {
      return c.json({ error: 'AI binding not available' }, 500)
    }

    // Use embedded function calling with Hermes 2 Pro
    const result = await runWithTools(
      c.env.AI,
      '@hf/nousresearch/hermes-2-pro-mistral-7b',
      messages,
      tools
    );

    console.log('Function calling result:', result)

    return c.json({
      role: 'assistant',
      content: result.response
    })
    
  } catch (error) {
    console.error('Chat tools error:', error)
    return c.json({ 
      error: 'Failed to process chat request with tools: ' + error.message 
    }, 500)
  }
})
*/

// Function calling chat endpoint using proper Cloudflare AI tools format
app.post('/api/chat-tools', async (c) => {
  try {
    const { messages, model = 'hermes-2-pro' } = await c.req.json()
    
    console.log('Function calling endpoint called with messages:', messages)
    console.log('Function calling model:', model)
    
    // Handle Gemini function calling via AI Gateway
    if (model === 'gemini-2.5-flash-lite') {
      if (!c.env.GOOGLE_API_KEY) {
        return c.json({ error: 'Google API key not configured' }, 500)
      }
      
      // Use AI Gateway URL if configured, otherwise direct Google API
      const baseUrl = c.env.AI_GATEWAY_URL || 'https://generativelanguage.googleapis.com'
      const apiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${c.env.GOOGLE_API_KEY}`
      
      // Define tools in Gemini format
      const geminiTools = [{
        function_declarations: [
          {
            name: "calculate",
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
            }
          },
          {
            name: "getCurrentTime",
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
            }
          },
          {
            name: "generateRandomNumber",
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
                  description: "The maximum value (exclusive)"
                },
                count: {
                  type: "number",
                  description: "How many random numbers to generate",
                  default: 1
                }
              },
              required: ["min", "max"]
            }
          },
          {
            name: "createTask",
            description: "Creates a new task with title, description, and priority",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "The task title"
                },
                description: {
                  type: "string", 
                  description: "Optional task description"
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  description: "Task priority level",
                  default: "medium"
                }
              },
              required: ["title"]
            }
          },
          {
            name: "testAPI",
            description: "Test internal API endpoints of the application. Can make GET, POST, PUT, DELETE requests to internal routes.",
            parameters: {
              type: "object",
              properties: {
                endpoint: {
                  type: "string",
                  description: "The API endpoint to test (e.g., '/api/chat', '/api/users', etc.)"
                },
                method: {
                  type: "string",
                  enum: ["GET", "POST", "PUT", "DELETE"],
                  description: "HTTP method to use",
                  default: "GET"
                },
                body: {
                  type: "string",
                  description: "JSON body for POST/PUT requests (optional)"
                },
                headers: {
                  type: "string",
                  description: "Additional headers as JSON string (optional)"
                }
              },
              required: ["endpoint"]
            }
          }
        ]
      }]
      
      // Convert messages to Gemini format
      const geminiMessages = messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
      
      try {
        const geminiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiMessages,
            tools: geminiTools,
            tool_config: {
              function_calling_config: {
                mode: "AUTO"
              }
            },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            }
          })
        })

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text()
          console.error('Gemini API error:', errorText)
          return c.json({ error: 'Failed to call Gemini API: ' + errorText }, 500)
        }

        const geminiData: any = await geminiResponse.json()
        console.log('Gemini function calling response:', JSON.stringify(geminiData, null, 2))
        
        const candidate = geminiData.candidates?.[0]
        if (!candidate) {
          return c.json({ error: 'No response candidate from Gemini' }, 500)
        }
        
        const content = candidate.content
        let finalResponse = ''
        
        // Check for function calls
        if (content.parts) {
          for (const part of content.parts) {
            if (part.functionCall) {
              // Execute function call
              const functionName = part.functionCall.name
              const functionArgs = part.functionCall.args || {}
              
              console.log(`Executing function: ${functionName} with args:`, functionArgs)
              
              let functionResult = ''
              
              switch (functionName) {
                case 'calculate':
                  try {
                    const expression = functionArgs.expression
                    if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
                      functionResult = 'Error: Invalid expression. Only numbers and basic operators are allowed.'
                    } else {
                      try {
                        // Simple expression evaluator for basic math operations
                        const safeExpression = expression.replace(/\s+/g, '')
                        let result: number
                        
                        // For now, use eval as a fallback (this would be replaced with a proper parser in production)
                        try {
                          result = eval(safeExpression)
                        } catch {
                          // If eval fails, try a simple calculation
                          if (safeExpression.match(/^\d+[\+\-\*\/]\d+$/)) {
                            const match = safeExpression.match(/^(\d+)([\+\-\*\/])(\d+)$/)
                            if (match) {
                              const [, a, op, b] = match
                              const numA = parseFloat(a)
                              const numB = parseFloat(b)
                              switch (op) {
                                case '+': result = numA + numB; break
                                case '-': result = numA - numB; break
                                case '*': result = numA * numB; break
                                case '/': result = numA / numB; break
                                default: throw new Error('Invalid operator')
                              }
                            } else {
                              throw new Error('Invalid expression format')
                            }
                          } else {
                            throw new Error('Expression too complex')
                          }
                        }
                        
                        if (typeof result !== 'number' || !isFinite(result)) {
                          functionResult = 'Error: Invalid mathematical expression'
                        } else {
                          functionResult = `The result of ${expression} is ${result}`
                        }
                      } catch (evalError) {
                        console.error('Expression evaluation error:', evalError)
                        functionResult = `Error: Failed to evaluate "${expression}"`
                      }
                    }
                  } catch (error) {
                    functionResult = 'Error: Failed to evaluate expression'
                  }
                  break
                  
                case 'getCurrentTime':
                  try {
                    const timezone = functionArgs.timezone || 'UTC'
                    const now = new Date()
                    const timeString = now.toLocaleString('en-US', { 
                      timeZone: timezone,
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZoneName: 'short'
                    })
                    functionResult = `Current time in ${timezone}: ${timeString}`
                  } catch (error) {
                    functionResult = 'Error: Failed to get current time'
                  }
                  break
                  
                case 'generateRandomNumber':
                  try {
                    const min = functionArgs.min
                    const max = functionArgs.max
                    const count = functionArgs.count || 1
                    
                    if (count <= 0 || count > 10) {
                      functionResult = 'Error: Count must be between 1 and 10'
                    } else {
                      const numbers = []
                      for (let i = 0; i < count; i++) {
                        numbers.push(Math.floor(Math.random() * (max - min)) + min)
                      }
                      functionResult = `Generated random number${count > 1 ? 's' : ''}: ${numbers.join(', ')}`
                    }
                  } catch (error) {
                    functionResult = 'Error: Failed to generate random number'
                  }
                  break
                  
                case 'createTask':
                  try {
                    const title = functionArgs.title
                    const description = functionArgs.description || ''
                    const priority = functionArgs.priority || 'medium'
                    
                    const task = {
                      id: crypto.randomUUID(),
                      title,
                      description,
                      priority,
                      created: new Date().toISOString()
                    }
                    
                    functionResult = `Task created successfully: "${title}" (Priority: ${priority})`
                  } catch (error) {
                    functionResult = 'Error: Failed to create task'
                  }
                  break
                  
                case 'testAPI':
                  try {
                    const endpoint = functionArgs.endpoint
                    const method = (functionArgs.method || 'GET').toUpperCase()
                    const body = functionArgs.body
                    const headers = functionArgs.headers
                    
                    // Construct the full URL (assuming we're running on localhost:8788 for the worker)
                    const baseUrl = 'http://localhost:8788'
                    const fullUrl = baseUrl + endpoint
                    
                    // Prepare request options
                    const requestOptions: any = {
                      method: method,
                      headers: {
                        'Content-Type': 'application/json',
                        ...(headers ? JSON.parse(headers) : {})
                      }
                    }
                    
                    // Add body for POST/PUT requests
                    if ((method === 'POST' || method === 'PUT') && body) {
                      requestOptions.body = body
                    }
                    
                    console.log(`Testing API: ${method} ${fullUrl}`)
                    
                    const response = await fetch(fullUrl, requestOptions)
                    const responseText = await response.text()
                    
                    let responseData
                    try {
                      responseData = JSON.parse(responseText)
                    } catch {
                      responseData = responseText
                    }
                    
                    functionResult = `API Test Result:
Status: ${response.status} ${response.statusText}
Endpoint: ${endpoint}
Method: ${method}
Response: ${JSON.stringify(responseData, null, 2)}`
                    
                  } catch (error) {
                    console.error('API test error:', error)
                    functionResult = `Error testing API: ${error.message}`
                  }
                  break
                  
                default:
                  functionResult = `Error: Unknown function ${functionName}`
              }
              
              finalResponse += functionResult + '\n\n'
              
            } else if (part.text) {
              finalResponse += part.text
            }
          }
        }
        
        return c.json({
          role: 'assistant',
          content: finalResponse.trim() || 'I executed the function but didn\'t get a clear result.'
        })
        
      } catch (error) {
        console.error('Gemini function calling error:', error)
        return c.json({ error: 'Failed to process Gemini function calling: ' + error.message }, 500)
      }
    }
    
    // Check if AI binding is available for Cloudflare models
    if (!c.env.AI) {
      return c.json({ error: 'AI binding not available' }, 500)
    }

    // Define tools in proper Cloudflare AI format
    const tools = [
      {
        name: "calculate",
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
        }
      },
      {
        name: "getCurrentTime",
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
        }
      },
      {
        name: "generateRandomNumber",
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
        }
      },
      {
        name: "createTask",
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
        }
      }
    ]
    
    // Call Cloudflare AI with proper tools format
    const response = await c.env.AI.run('@hf/nousresearch/hermes-2-pro-mistral-7b', {
      messages: messages,
      tools: tools,
      max_tokens: 500,
      temperature: 0.7
    })

    console.log('Raw AI response:', response)
    
    // Handle tool calls in the response
    if (response.tool_calls && response.tool_calls.length > 0) {
      let finalResponse = response.response || ''
      
      for (const toolCall of response.tool_calls) {
        console.log('Processing tool call:', toolCall)
        
        let toolResult = ''
        
        switch (toolCall.name) {
          case 'calculate':
            try {
              const expression = toolCall.arguments.expression
              if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
                toolResult = 'Error: Invalid expression. Only numbers and basic operators are allowed.'
              } else {
                const result = Function('"use strict"; return (' + expression + ')')()
                if (typeof result !== 'number' || !isFinite(result)) {
                  toolResult = 'Error: Invalid mathematical expression'
                } else {
                  toolResult = `The result of ${expression} is ${result}`
                }
              }
            } catch (error) {
              toolResult = 'Error: Failed to evaluate expression'
            }
            break
            
          case 'getCurrentTime':
            try {
              const timezone = toolCall.arguments.timezone || 'UTC'
              const now = new Date()
              const timeString = now.toLocaleString('en-US', { 
                timeZone: timezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
              toolResult = `Current time in ${timezone}: ${timeString}`
            } catch (error) {
              toolResult = 'Error: Failed to get current time'
            }
            break
            
          case 'generateRandomNumber':
            try {
              const { min, max, count = 1 } = toolCall.arguments
              if (min > max) {
                toolResult = 'Error: Minimum value cannot be greater than maximum value'
              } else if (count < 1 || count > 100) {
                toolResult = 'Error: Count must be between 1 and 100'
              } else {
                const numbers = []
                for (let i = 0; i < count; i++) {
                  const randomNum = Math.floor(Math.random() * (max - min + 1)) + min
                  numbers.push(randomNum)
                }
                toolResult = `Generated random number${count > 1 ? 's' : ''}: ${numbers.join(', ')}`
              }
            } catch (error) {
              toolResult = 'Error: Failed to generate random number'
            }
            break
            
          case 'createTask':
            try {
              const { title, description, priority = 'medium' } = toolCall.arguments
              const task = {
                id: crypto.randomUUID(),
                title,
                description: description || null,
                priority,
                created: new Date().toISOString(),
                completed: false
              }
              toolResult = `Task created successfully: "${title}" (Priority: ${priority})`
            } catch (error) {
              toolResult = 'Error: Failed to create task'
            }
            break
            
          default:
            toolResult = `Error: Unknown tool "${toolCall.name}"`
        }
        
        // Append tool result to the response
        finalResponse += '\n\n' + toolResult
      }
      
      console.log('Function calling result:', finalResponse)
      
      return c.json({
        role: 'assistant',
        content: finalResponse.trim()
      })
    } else {
      // No tool calls, return regular response
      console.log('No tool calls found, returning regular response:', response.response)
      
      return c.json({
        role: 'assistant',
        content: response.response || 'I apologize, but I received an empty response.'
      })
    }
    
  } catch (error) {
    console.error('Chat tools error:', error)
    return c.json({ 
      error: 'Failed to process chat request with tools: ' + error.message 
    }, 500)
  }
})

// Mock data storage (in-memory for demo purposes)
let mockTasks: any[] = [
  { id: '1', title: 'Setup project', description: 'Initialize the new project', priority: 'high', status: 'completed', created: '2025-08-28T10:00:00Z' },
  { id: '2', title: 'Implement API', description: 'Create REST API endpoints', priority: 'medium', status: 'in-progress', created: '2025-08-28T11:00:00Z' },
  { id: '3', title: 'Write tests', description: 'Add unit and integration tests', priority: 'medium', status: 'pending', created: '2025-08-28T12:00:00Z' },
]

let mockUsers: any[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin', active: true, created: '2025-01-01T00:00:00Z' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user', active: true, created: '2025-01-15T00:00:00Z' },
  { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'user', active: false, created: '2025-02-01T00:00:00Z' },
]

// Tasks API endpoints
app.get('/api/tasks', (c) => {
  return c.json({ 
    success: true, 
    data: mockTasks, 
    total: mockTasks.length 
  })
})

app.get('/api/tasks/:id', (c) => {
  const id = c.req.param('id')
  const task = mockTasks.find(t => t.id === id)
  
  if (!task) {
    return c.json({ success: false, error: 'Task not found' }, 404)
  }
  
  return c.json({ success: true, data: task })
})

app.post('/api/tasks', async (c) => {
  try {
    const body = await c.req.json()
    const { title, description, priority = 'medium' } = body
    
    if (!title) {
      return c.json({ success: false, error: 'Title is required' }, 400)
    }
    
    const newTask = {
      id: (mockTasks.length + 1).toString(),
      title,
      description: description || '',
      priority,
      status: 'pending',
      created: new Date().toISOString()
    }
    
    mockTasks.push(newTask)
    
    return c.json({ success: true, data: newTask, message: 'Task created successfully' }, 201)
  } catch (error) {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400)
  }
})

app.put('/api/tasks/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const taskIndex = mockTasks.findIndex(t => t.id === id)
    
    if (taskIndex === -1) {
      return c.json({ success: false, error: 'Task not found' }, 404)
    }
    
    mockTasks[taskIndex] = { ...mockTasks[taskIndex], ...body, id }
    
    return c.json({ success: true, data: mockTasks[taskIndex], message: 'Task updated successfully' })
  } catch (error) {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400)
  }
})

app.delete('/api/tasks/:id', (c) => {
  const id = c.req.param('id')
  const taskIndex = mockTasks.findIndex(t => t.id === id)
  
  if (taskIndex === -1) {
    return c.json({ success: false, error: 'Task not found' }, 404)
  }
  
  const deletedTask = mockTasks.splice(taskIndex, 1)[0]
  
  return c.json({ success: true, data: deletedTask, message: 'Task deleted successfully' })
})

// Users API endpoints
app.get('/api/users', (c) => {
  const { active, role } = c.req.query()
  let filteredUsers = mockUsers
  
  if (active !== undefined) {
    filteredUsers = filteredUsers.filter(u => u.active === (active === 'true'))
  }
  
  if (role) {
    filteredUsers = filteredUsers.filter(u => u.role === role)
  }
  
  return c.json({ 
    success: true, 
    data: filteredUsers, 
    total: filteredUsers.length,
    message: "HMR is working!"
  })
})

app.get('/api/users/:id', (c) => {
  const id = c.req.param('id')
  const user = mockUsers.find(u => u.id === id)
  
  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404)
  }
  
  return c.json({ success: true, data: user })
})

app.post('/api/users', async (c) => {
  try {
    const body = await c.req.json()
    const { name, email, role = 'user' } = body
    
    if (!name || !email) {
      return c.json({ success: false, error: 'Name and email are required' }, 400)
    }
    
    // Check if email already exists
    if (mockUsers.some(u => u.email === email)) {
      return c.json({ success: false, error: 'Email already exists' }, 409)
    }
    
    const newUser = {
      id: (mockUsers.length + 1).toString(),
      name,
      email,
      role,
      active: true,
      created: new Date().toISOString()
    }
    
    mockUsers.push(newUser)
    
    return c.json({ success: true, data: newUser, message: 'User created successfully' }, 201)
  } catch (error) {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400)
  }
})

// Test route
app.get('/api/test', (c) => {
  return c.json({ message: 'Test route works!' })
})

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Handle static assets and SPA routing
app.get('*', async (c) => {
  // Skip API routes - they should be handled above
  if (c.req.path.startsWith('/api/')) {
    return c.text('Not found', 404)
  }
  
  // Handle static assets first
  try {
    const response = await c.env.ASSETS.fetch(c.req.raw)
    if (response.status !== 404) {
      return response
    }
  } catch (_e) {
    // If ASSETS is not available, continue to fallback
  }

  // For SPA routing, serve index.html for non-API routes
  try {
    const indexRequest = new Request(new URL('/index.html', c.req.url), c.req.raw)
    return await c.env.ASSETS.fetch(indexRequest)
  } catch (_e) {
    // Fallback for development when ASSETS is not available
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shadcn Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Manrope:wght@200..800&display=swap" rel="stylesheet" />
  <meta name="theme-color" content="#fff" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`)
  }
})

export default app
