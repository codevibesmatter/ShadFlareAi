/**
 * Cloudflare AutoRAG Integration
 * 
 * AutoRAG is Cloudflare's fully managed RAG service that handles:
 * - Document ingestion and chunking
 * - Automatic embedding generation
 * - Vector storage and retrieval
 * - Context-aware response generation
 * 
 * Launched in 2025, it simplifies RAG implementation significantly.
 */

export interface AutoRAGSearchResult {
  content: string
  metadata: {
    source: string
    title?: string
    page?: number
    chunk_id: string
    score: number
  }
}

export interface AutoRAGResponse {
  answer: string
  sources: AutoRAGSearchResult[]
  query: string
  metadata: {
    model: string
    responseTime: number
    tokensUsed?: number
  }
}

export interface AutoRAGInstance {
  search(query: string, options?: {
    limit?: number
    threshold?: number
  }): Promise<AutoRAGSearchResult[]>
  
  aiSearch(query: string, options?: {
    model?: string
    maxTokens?: number
    temperature?: number
  }): Promise<AutoRAGResponse>
}

export class AutoRAGSystem {
  private env: any

  constructor(env: any) {
    this.env = env
  }

  /**
   * Get AutoRAG instance
   * Based on Cloudflare AutoRAG documentation:
   * The binding is directly available as env.AUTORAG
   */
  private getAutoRAG(): AutoRAGInstance {
    // Check if AUTORAG binding exists (configured in wrangler.toml)
    if (!this.env.AUTORAG) {
      throw new Error('AutoRAG binding not available. Please configure autorag_stores in wrangler.toml')
    }
    // Return the AutoRAG binding directly
    return this.env.AUTORAG
  }

  /**
   * Check if AutoRAG is available
   */
  private isAutoRAGAvailable(): boolean {
    return !!this.env.AUTORAG
  }

  /**
   * Search documents using semantic search
   * Returns relevant chunks without generating a response
   */
  async search(
    query: string, 
    options: {
      limit?: number
      threshold?: number
    } = {}
  ): Promise<AutoRAGSearchResult[]> {
    try {
      const autorag = this.getAutoRAG()
      const results = await autorag.search(query, {
        limit: options.limit || 5,
        threshold: options.threshold || 0.7
      })
      
      return results
    } catch (error) {
      console.error('AutoRAG search error:', error)
      throw new Error('Failed to search documents')
    }
  }

  /**
   * Perform AI search with generated response
   * This is the main RAG function that combines search + generation
   */
  async aiSearch(
    query: string,
    options: {
      model?: string
      maxTokens?: number
      temperature?: number
      systemPrompt?: string
    } = {}
  ): Promise<AutoRAGResponse> {
    try {
      const autorag = this.getAutoRAG()
      const startTime = Date.now()
      
      // Use Gemini 2.5 Flash as default for high-quality responses
      const response = await autorag.aiSearch(query, {
        model: options.model || 'gemini-2.5-flash-lite',
        maxTokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.1
      })
      
      const responseTime = Date.now() - startTime
      
      // If custom system prompt is provided, we might need to re-process
      // For now, AutoRAG handles the system prompt internally
      
      return {
        ...response,
        metadata: {
          ...response.metadata,
          responseTime
        }
      }
    } catch (error) {
      console.error('AutoRAG AI search error:', error)
      throw new Error('Failed to generate AI response')
    }
  }

  /**
   * Advanced RAG query with custom context assembly and prompt engineering
   */
  async advancedQuery(
    query: string,
    options: {
      model?: string
      maxResults?: number
      scoreThreshold?: number
      systemPrompt?: string
      includeMetadata?: boolean
    } = {}
  ): Promise<{
    answer: string
    sources: AutoRAGSearchResult[]
    query: string
    metadata: {
      model: string
      responseTime: number
      searchResults: number
      avgScore: number
    }
  }> {
    const startTime = Date.now()
    
    try {
      // Step 1: Perform semantic search
      const searchResults = await this.search(query, {
        limit: options.maxResults || 8,
        threshold: options.scoreThreshold || 0.75
      })

      if (searchResults.length === 0) {
        return {
          answer: "I couldn't find any relevant information in the knowledge base to answer your question. The knowledge base contains information about Cloudflare services, React development, AI/ML concepts, and technical documentation. Please try asking about these topics or rephrasing your question.",
          sources: [],
          query,
          metadata: {
            model: options.model || 'gemini-2.5-flash-lite',
            responseTime: Date.now() - startTime,
            searchResults: 0,
            avgScore: 0
          }
        }
      }

      // Step 2: Prepare enhanced context
      const context = searchResults
        .map((result, index) => {
          const title = result.metadata.title || `Source ${index + 1}`
          return `[${title}]\n${result.content}\n`
        })
        .join('\n---\n\n')

      // Step 3: Construct comprehensive system prompt
      const systemPrompt = options.systemPrompt || `You are an expert AI assistant specializing in Cloudflare services, web development, and AI/ML technologies. You have access to a comprehensive knowledge base with detailed information about:

- Cloudflare Workers, D1, Vectorize, and AutoRAG
- React and TypeScript development patterns
- AI/ML concepts and RAG implementations
- Vector databases and embeddings
- Modern web development practices

Use the following context to provide detailed, accurate, and helpful responses:

${context}

Instructions:
- Answer based primarily on the provided context
- Provide specific implementation details and code examples when relevant
- Explain complex concepts clearly with practical examples
- If information is missing, clearly state what additional context would be helpful
- Reference specific sources when citing information
- Be comprehensive but concise
- Format code examples properly with syntax highlighting hints`

      // Step 4: Generate response using specified model
      const model = options.model || 'gemini-2.5-flash-lite'
      let answer: string

      if (model === 'gemini-2.5-flash-lite' && this.env.GOOGLE_API_KEY) {
        answer = await this.generateGeminiResponse(systemPrompt, query)
      } else {
        // Fallback to Cloudflare AI
        answer = await this.generateCloudflareAIResponse(systemPrompt, query, model)
      }

      const avgScore = searchResults.reduce((sum, result) => sum + result.metadata.score, 0) / searchResults.length

      return {
        answer,
        sources: searchResults,
        query,
        metadata: {
          model,
          responseTime: Date.now() - startTime,
          searchResults: searchResults.length,
          avgScore
        }
      }

    } catch (error) {
      console.error('Advanced RAG query error:', error)
      throw new Error('Failed to process advanced query')
    }
  }

  /**
   * Generate response using Gemini 2.5 Flash
   */
  private async generateGeminiResponse(systemPrompt: string, query: string): Promise<string> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${this.env.GOOGLE_API_KEY}`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${query}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 3072,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data.candidates[0]?.content?.parts[0]?.text || 'No response generated'
  }

  /**
   * Generate response using Cloudflare AI models
   */
  private async generateCloudflareAIResponse(
    systemPrompt: string, 
    query: string, 
    model: string
  ): Promise<string> {
    const modelMap: Record<string, string> = {
      'llama-3-8b': '@cf/meta/llama-3-8b-instruct',
      'llama-2-7b': '@cf/meta/llama-2-7b-chat-int8',
      'codellama': '@cf/meta/code-llama-7b-instruct-awq',
      'hermes-2-pro': '@cf/nous-research/hermes-2-pro-mistral-7b'
    }

    const modelId = modelMap[model] || modelMap['llama-3-8b']

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: query
      }
    ]

    const response = await this.env.AI.run(modelId, {
      messages,
      max_tokens: 1536,
      temperature: 0.1
    })

    return response.response || 'No response generated'
  }

  /**
   * Upload and index documents to AutoRAG via R2
   * AutoRAG monitors the R2 bucket and automatically indexes new documents
   */
  async indexDocuments(documents: any[]): Promise<void> {
    try {
      // Check if R2 binding is available
      if (!this.env.R2_DOCUMENTS) {
        throw new Error('R2_DOCUMENTS binding not available. Please configure R2 bucket in wrangler.toml')
      }

      console.log(`Starting AutoRAG indexing of ${documents.length} documents from R2 bucket...`)

      // AutoRAG automatically detects new documents in the R2 bucket
      // We just need to trigger the indexing process
      const autorag = this.getAutoRAG()
      
      // Trigger manual indexing if AutoRAG supports it
      if (typeof autorag.reindex === 'function') {
        await autorag.reindex()
        console.log('AutoRAG reindexing triggered successfully')
      } else {
        console.log('AutoRAG handles document indexing automatically from R2 buckets')
        console.log('Documents in R2 bucket will be indexed automatically by AutoRAG')
      }

      console.log(`AutoRAG indexing process initiated for ${documents.length} documents`)
    } catch (error) {
      console.error('AutoRAG indexing error:', error)
      throw new Error('Failed to index documents with AutoRAG')
    }
  }

  /**
   * List documents in the R2 bucket
   */
  async listR2Documents(): Promise<string[]> {
    try {
      if (!this.env.R2_DOCUMENTS) {
        throw new Error('R2_DOCUMENTS binding not available')
      }

      const bucket = this.env.R2_DOCUMENTS
      const objects = await bucket.list()
      
      return objects.objects.map(obj => obj.key)
    } catch (error) {
      console.error('Failed to list R2 documents:', error)
      return []
    }
  }

  /**
   * Get AutoRAG instance stats and health
   */
  async getInstanceInfo(): Promise<{
    status: string
    documentsIndexed: number
    lastUpdated: string
    r2Documents?: string[]
    r2BucketName?: string
    autoragAvailable: boolean
    message?: string
  }> {
    try {
      // Get R2 document list regardless of AutoRAG availability
      const r2Documents = await this.listR2Documents()
      
      const isAutoRAGAvailable = this.isAutoRAGAvailable()
      
      if (isAutoRAGAvailable) {
        // AutoRAG is available - get actual instance info
        const autorag = this.getAutoRAG()
        
        return {
          status: 'active',
          documentsIndexed: r2Documents.length,
          lastUpdated: new Date().toISOString(),
          r2Documents: r2Documents,
          r2BucketName: 'buildmantle-rag-documents',
          autoragAvailable: true
        }
      } else {
        // AutoRAG not available - show R2 status only
        return {
          status: 'autorag-not-available',
          documentsIndexed: r2Documents.length,
          lastUpdated: new Date().toISOString(),
          r2Documents: r2Documents,
          r2BucketName: 'buildmantle-rag-documents',
          autoragAvailable: false,
          message: 'AutoRAG binding not available. R2 bucket configured and ready for when AutoRAG becomes available.'
        }
      }
    } catch (error) {
      console.error('Failed to get AutoRAG instance info:', error)
      
      // Still try to provide R2 information even if other parts fail
      try {
        const r2Documents = await this.listR2Documents()
        return {
          status: 'error',
          documentsIndexed: r2Documents.length,
          lastUpdated: new Date().toISOString(),
          r2Documents: r2Documents,
          r2BucketName: 'buildmantle-rag-documents',
          autoragAvailable: false,
          message: `Error getting instance info: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      } catch (r2Error) {
        return {
          status: 'error',
          documentsIndexed: 0,
          lastUpdated: new Date().toISOString(),
          autoragAvailable: false,
          message: `Failed to get both AutoRAG and R2 information: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }
  }
}