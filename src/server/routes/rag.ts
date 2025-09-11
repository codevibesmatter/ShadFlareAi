import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { AutoRAGSystem } from '@/lib/autorag-system'
import { RAGSystem } from '@/lib/rag-system'
import { sampleDocuments } from '@/data/sample-documents'

const app = new Hono()

// Request schemas
const SearchQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.string().transform((val) => parseInt(val, 10) || 5).optional().default('5'),
  threshold: z.string().transform((val) => parseFloat(val) || 0.7).optional().default('0.7')
})

const AISearchSchema = z.object({
  query: z.string().min(1).max(1000),
  model: z.string().optional().default('gemini-2.5-flash-lite'),
  maxTokens: z.number().optional().default(2048),
  temperature: z.number().optional().default(0.1),
  systemPrompt: z.string().optional(),
  useAutoRAG: z.boolean().optional().default(true)
})

const DirectLLMSchema = z.object({
  query: z.string().min(1).max(1000),
  model: z.string().optional().default('gemini-2.5-flash-lite'),
  maxTokens: z.number().optional().default(2048),
  temperature: z.number().optional().default(0.1),
  systemPrompt: z.string().optional()
})

const IngestDocumentsSchema = z.object({
  useAutoRAG: z.boolean().optional().default(true),
  method: z.string().optional().default('autorag')
})

/**
 * GET /api/rag/search
 * Semantic search without response generation
 */
app.get('/search', zValidator('query', SearchQuerySchema), async (c) => {
  try {
    const { query, limit, threshold } = c.req.valid('query')
    
    // Try AutoRAG first, fallback to custom implementation
    try {
      const autoRAG = new AutoRAGSystem(c.env)
      const results = await autoRAG.search(query, { limit, threshold })
      
      return c.json({
        success: true,
        data: {
          results,
          query,
          method: 'autorag',
          count: results.length
        }
      })
    } catch (autoRAGError) {
      console.warn('AutoRAG not available, using custom RAG:', autoRAGError)
      
      // Fallback to custom implementation
      const customRAG = new RAGSystem(c.env)
      const results = await customRAG.searchSimilarChunks(query, limit, threshold)
      
      return c.json({
        success: true,
        data: {
          results: results.map(r => ({
            content: r.chunk.content,
            metadata: {
              source: r.document.title,
              title: r.document.title,
              chunk_id: r.chunk.id,
              score: r.score,
              category: r.chunk.metadata.category,
              tags: r.chunk.metadata.tags
            }
          })),
          query,
          method: 'custom',
          count: results.length
        }
      })
    }
  } catch (error) {
    console.error('Search error:', error)
    return c.json({
      success: false,
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/query
 * Complete RAG pipeline with AI response generation
 */
app.post('/query', zValidator('json', AISearchSchema), async (c) => {
  try {
    const { 
      query, 
      model, 
      maxTokens, 
      temperature, 
      systemPrompt, 
      useAutoRAG 
    } = c.req.valid('json')
    
    if (useAutoRAG) {
      try {
        const autoRAG = new AutoRAGSystem(c.env)
        const result = await autoRAG.advancedQuery(query, {
          model,
          maxResults: 8,
          scoreThreshold: 0.75,
          systemPrompt
        })
        
        return c.json({
          success: true,
          data: {
            ...result,
            method: 'autorag'
          }
        })
      } catch (autoRAGError) {
        console.warn('AutoRAG not available, using custom RAG:', autoRAGError)
      }
    }
    
    // Custom RAG implementation
    const customRAG = new RAGSystem(c.env)
    const result = await customRAG.query(query, {
      maxResults: 8,
      scoreThreshold: 0.75,
      model
    })
    
    return c.json({
      success: true,
      data: {
        ...result,
        method: 'custom',
        metadata: {
          model,
          responseTime: 0, // Would be calculated
          searchResults: result.sources.length,
          avgScore: result.sources.reduce((sum, s) => sum + s.score, 0) / result.sources.length
        }
      }
    })
    
  } catch (error) {
    console.error('RAG query error:', error)
    return c.json({
      success: false,
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/direct
 * Direct LLM query without RAG (for A/B testing)
 */
app.post('/direct', zValidator('json', DirectLLMSchema), async (c) => {
  try {
    const { 
      query, 
      model, 
      maxTokens, 
      temperature, 
      systemPrompt 
    } = c.req.valid('json')
    
    const startTime = Date.now()
    
    // Direct LLM query without any retrieval context
    const defaultSystemPrompt = `You are a helpful AI assistant. Answer the user's question based on your training knowledge. Be accurate, comprehensive, and honest about what you know and don't know.`
    
    const finalSystemPrompt = systemPrompt || defaultSystemPrompt
    let response: string = ''
    
    if (model === 'gemini-2.5-flash-lite') {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${c.env.GOOGLE_API_KEY}`
      
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${finalSystemPrompt}\n\nUser Question: ${query}` }]
            }
          ],
          generationConfig: {
            temperature: temperature,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: maxTokens,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      })

      if (!apiResponse.ok) {
        throw new Error(`Gemini API error: ${apiResponse.status}`)
      }

      const data = await apiResponse.json()
      response = data.candidates[0]?.content?.parts[0]?.text || 'No response generated'
    } else {
      // Fallback to Cloudflare AI
      const messages = [
        {
          role: 'system',
          content: finalSystemPrompt
        },
        {
          role: 'user',
          content: query
        }
      ]

      const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages,
        max_tokens: maxTokens,
        temperature: temperature
      })

      response = aiResponse.response || 'No response generated'
    }
    
    const responseTime = Date.now() - startTime
    
    return c.json({
      success: true,
      data: {
        answer: response,
        query: query,
        method: 'direct-llm',
        metadata: {
          model,
          responseTime,
          temperature,
          maxTokens,
          systemPrompt: finalSystemPrompt,
          hasRAG: false
        }
      }
    })
    
  } catch (error) {
    console.error('Direct LLM query error:', error)
    return c.json({
      success: false,
      error: 'Direct query failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/ingest
 * Ingest sample documents into the RAG system
 */
app.post('/ingest', zValidator('json', IngestDocumentsSchema), async (c) => {
  try {
    const { useAutoRAG, method } = c.req.valid('json')
    
    // Force custom method or check if AutoRAG is available
    let shouldUseCustom = method === 'custom'
    
    if (!shouldUseCustom && useAutoRAG) {
      // Try AutoRAG first
      try {
        const autoRAG = new AutoRAGSystem(c.env)
        await autoRAG.getInstanceInfo()
        
        // AutoRAG available - use it
        console.log('AutoRAG handles document indexing automatically from R2 buckets or URLs')
        console.log(`Would index ${sampleDocuments.length} documents`)
        
        return c.json({
          success: true,
          data: {
            message: 'Documents queued for ingestion in AutoRAG',
            method: 'autorag',
            documentsCount: sampleDocuments.length,
            note: 'AutoRAG handles document processing automatically from configured sources'
          }
        })
      } catch (autoRAGError) {
        console.log('AutoRAG not available, using custom RAG:', autoRAGError)
        shouldUseCustom = true
      }
    }
    
    if (shouldUseCustom) {
      // Custom ingestion
      console.log(`Starting ingestion of ${sampleDocuments.length} documents...`)
      const customRAG = new RAGSystem(c.env)
      await customRAG.ingestDocuments(sampleDocuments)
      console.log('Document ingestion completed')
      
      return c.json({
        success: true,
        data: {
          message: 'Documents successfully ingested',
          method: 'custom',
          documentsCount: sampleDocuments.length
        }
      })
    }
    
  } catch (error) {
    console.error('Ingestion error:', error)
    return c.json({
      success: false,
      error: 'Ingestion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * GET /api/rag/status
 * Get RAG system status and information
 */
app.get('/status', async (c) => {
  try {
    const status = {
      autorag: {
        available: false,
        status: 'unknown',
        documentsIndexed: 0
      },
      custom: {
        available: true,
        vectorize: !!c.env.VECTORIZE,
        ai: !!c.env.AI
      },
      models: {
        available: [
          'gemini-2.5-flash-lite',
          'llama-3-8b',
          'llama-2-7b',
          'hermes-2-pro',
          'codellama'
        ],
        default: 'gemini-2.5-flash-lite'
      },
      sampleDocuments: {
        count: sampleDocuments.length,
        categories: [...new Set(sampleDocuments.map(d => d.category))],
        totalTokensEstimate: sampleDocuments.reduce((sum, doc) => sum + doc.content.split(' ').length, 0)
      }
    }
    
    // Try to get AutoRAG status
    try {
      const autoRAG = new AutoRAGSystem(c.env)
      const instanceInfo = await autoRAG.getInstanceInfo()
      status.autorag = {
        available: true,
        status: instanceInfo.status,
        documentsIndexed: instanceInfo.documentsIndexed
      }
    } catch (error) {
      console.log('AutoRAG not available:', error)
    }
    
    return c.json({
      success: true,
      data: status
    })
    
  } catch (error) {
    console.error('Status check error:', error)
    return c.json({
      success: false,
      error: 'Status check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * GET /api/rag/documents
 * Get list of available sample documents
 */
app.get('/documents', async (c) => {
  try {
    const documentSummaries = sampleDocuments.map(doc => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
      metadata: doc.metadata,
      contentLength: doc.content.length,
      wordCount: doc.content.split(' ').length,
      excerpt: doc.content.substring(0, 200) + '...'
    }))
    
    return c.json({
      success: true,
      data: {
        documents: documentSummaries,
        totalCount: documentSummaries.length,
        categories: [...new Set(sampleDocuments.map(d => d.category))],
        totalWords: documentSummaries.reduce((sum, doc) => sum + doc.wordCount, 0)
      }
    })
    
  } catch (error) {
    console.error('Documents list error:', error)
    return c.json({
      success: false,
      error: 'Failed to get documents list',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/ingest-r2
 * Ingest documents from R2 bucket into Vectorize
 */
app.post('/ingest-r2', async (c) => {
  try {
    console.log('Starting R2 document ingestion into Vectorize...')
    const ragSystem = new RAGSystem(c.env)
    const result = await ragSystem.ingestFromR2()
    
    return c.json({
      success: result.success,
      data: {
        message: `Successfully ingested ${result.documentsProcessed} documents from R2`,
        documentsProcessed: result.documentsProcessed,
        errors: result.errors,
        source: 'R2_DOCUMENTS bucket'
      }
    })
  } catch (error) {
    console.error('R2 ingestion error:', error)
    return c.json({
      success: false,
      error: 'R2 ingestion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * AutoRAG-specific endpoints
 */

/**
 * GET /api/rag/autorag/status
 * Get AutoRAG instance status and R2 document information
 */
app.get('/autorag/status', async (c) => {
  try {
    const autoRAG = new AutoRAGSystem(c.env)
    const info = await autoRAG.getInstanceInfo()
    
    return c.json({
      success: true,
      data: info
    })
  } catch (error) {
    console.error('AutoRAG status error:', error)
    return c.json({
      success: false,
      error: 'Failed to get AutoRAG status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/autorag/search
 * Perform AutoRAG semantic search
 */
app.post('/autorag/search', zValidator('json', SearchQuerySchema.omit({ limit: true, threshold: true }).extend({
  limit: z.number().optional().default(5),
  threshold: z.number().optional().default(0.7)
})), async (c) => {
  try {
    const { query, limit, threshold } = c.req.valid('json')
    
    const autoRAG = new AutoRAGSystem(c.env)
    const results = await autoRAG.search(query, { limit, threshold })
    
    return c.json({
      success: true,
      data: {
        results,
        query,
        metadata: {
          resultCount: results.length,
          avgScore: results.reduce((sum, r) => sum + r.metadata.score, 0) / results.length || 0
        }
      }
    })
  } catch (error) {
    console.error('AutoRAG search error:', error)
    return c.json({
      success: false,
      error: 'AutoRAG search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/autorag/ai-search
 * Perform AutoRAG AI search with generated response
 */
app.post('/autorag/ai-search', zValidator('json', AISearchSchema.omit({ useAutoRAG: true })), async (c) => {
  try {
    const { query, model, maxTokens, temperature, systemPrompt } = c.req.valid('json')
    
    const autoRAG = new AutoRAGSystem(c.env)
    const result = await autoRAG.aiSearch(query, {
      model,
      maxTokens,
      temperature,
      systemPrompt
    })
    
    return c.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('AutoRAG AI search error:', error)
    return c.json({
      success: false,
      error: 'AutoRAG AI search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/autorag/advanced-query
 * Perform advanced AutoRAG query with custom context assembly
 */
app.post('/autorag/advanced-query', zValidator('json', AISearchSchema.omit({ useAutoRAG: true }).extend({
  maxResults: z.number().optional().default(8),
  scoreThreshold: z.number().optional().default(0.75),
  includeMetadata: z.boolean().optional().default(true)
})), async (c) => {
  try {
    const { 
      query, 
      model, 
      maxTokens, 
      temperature, 
      systemPrompt,
      maxResults,
      scoreThreshold,
      includeMetadata
    } = c.req.valid('json')
    
    const autoRAG = new AutoRAGSystem(c.env)
    const result = await autoRAG.advancedQuery(query, {
      model,
      maxResults,
      scoreThreshold,
      systemPrompt,
      includeMetadata
    })
    
    return c.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('AutoRAG advanced query error:', error)
    return c.json({
      success: false,
      error: 'AutoRAG advanced query failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

/**
 * POST /api/rag/autorag/ingest
 * Trigger AutoRAG document ingestion from R2 bucket
 */
app.post('/autorag/ingest', async (c) => {
  try {
    const autoRAG = new AutoRAGSystem(c.env)
    await autoRAG.indexDocuments([]) // Empty array since we're using R2 bucket
    
    return c.json({
      success: true,
      data: {
        message: 'AutoRAG document indexing initiated',
        source: 'R2 bucket'
      }
    })
  } catch (error) {
    console.error('AutoRAG ingest error:', error)
    return c.json({
      success: false,
      error: 'AutoRAG ingestion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default app