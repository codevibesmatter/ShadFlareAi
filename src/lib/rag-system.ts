import type { Document } from '@/data/sample-documents'

export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  metadata: {
    title: string
    category: string
    tags: string[]
    chunkIndex: number
    totalChunks: number
    [key: string]: any
  }
}

export interface VectorizedChunk {
  id: string
  values: number[]
  metadata: DocumentChunk['metadata'] & {
    content: string
    documentId: string
  }
}

export interface SearchResult {
  chunk: DocumentChunk
  score: number
  document: Document
}

export class RAGSystem {
  private env: any

  constructor(env: any) {
    this.env = env
  }

  /**
   * Split document content into overlapping chunks
   */
  private chunkDocument(document: Document, maxChunkSize = 400, overlap = 50): DocumentChunk[] {
    const words = document.content.split(/\s+/)
    const chunks: DocumentChunk[] = []
    let currentIndex = 0
    let chunkIndex = 0

    while (currentIndex < words.length) {
      const endIndex = Math.min(currentIndex + maxChunkSize, words.length)
      const chunkWords = words.slice(currentIndex, endIndex)
      const chunkContent = chunkWords.join(' ')

      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        documentId: document.id,
        content: chunkContent,
        metadata: {
          title: document.title,
          category: document.category,
          tags: document.tags,
          chunkIndex,
          totalChunks: 0, // Will be updated after all chunks are created
          ...document.metadata
        }
      })

      currentIndex += maxChunkSize - overlap
      chunkIndex++
    }

    // Update totalChunks for all chunks
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length
    })

    return chunks
  }

  /**
   * Generate embeddings for text content
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [text]
      })
      
      if (response?.data?.[0]) {
        return response.data[0]
      }
      
      throw new Error('No embedding data returned')
    } catch (error) {
      console.error('Error generating embedding:', error)
      throw new Error('Failed to generate embedding')
    }
  }

  /**
   * Ingest a single document into the vector database
   */
  async ingestDocument(document: Document): Promise<void> {
    try {
      // Step 1: Chunk the document
      const chunks = this.chunkDocument(document)
      console.log(`Processing ${chunks.length} chunks for document: ${document.title}`)

      // Step 2: Generate embeddings and vectorize chunks
      const vectorizedChunks: VectorizedChunk[] = []
      
      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.content)
        
        vectorizedChunks.push({
          id: chunk.id,
          values: embedding,
          metadata: {
            ...chunk.metadata,
            content: chunk.content,
            documentId: chunk.documentId
          }
        })
      }

      // Step 3: Store in Vectorize
      await this.env.VECTORIZE.upsert(vectorizedChunks)
      console.log(`Successfully ingested ${vectorizedChunks.length} chunks for document: ${document.title}`)

    } catch (error) {
      console.error(`Failed to ingest document ${document.id}:`, error)
      throw error
    }
  }

  /**
   * Ingest multiple documents
   */
  async ingestDocuments(documents: Document[]): Promise<void> {
    console.log(`Starting ingestion of ${documents.length} documents...`)
    
    for (const document of documents) {
      try {
        await this.ingestDocument(document)
      } catch (error) {
        console.error(`Failed to ingest document ${document.id}, continuing with next...`, error)
      }
    }
    
    console.log('Document ingestion completed')
  }

  /**
   * Search for relevant chunks based on query
   */
  async searchSimilarChunks(
    query: string, 
    limit = 5,
    scoreThreshold = 0.7
  ): Promise<SearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query)

      // Search in Vectorize
      const searchResults = await this.env.VECTORIZE.query(queryEmbedding, {
        topK: limit,
        returnMetadata: 'all'
      })

      // Filter by score threshold and transform results
      const filteredResults: SearchResult[] = []
      
      for (const result of searchResults.matches || []) {
        if (result.score >= scoreThreshold) {
          const chunk: DocumentChunk = {
            id: result.id,
            documentId: result.metadata.documentId,
            content: result.metadata.content,
            metadata: {
              title: result.metadata.title,
              category: result.metadata.category,
              tags: result.metadata.tags,
              chunkIndex: result.metadata.chunkIndex,
              totalChunks: result.metadata.totalChunks,
              author: result.metadata.author,
              createdAt: result.metadata.createdAt,
              updatedAt: result.metadata.updatedAt,
              source: result.metadata.source
            }
          }

          // Create a mock document for the search result
          const document: Document = {
            id: result.metadata.documentId,
            title: result.metadata.title,
            content: result.metadata.content,
            category: result.metadata.category,
            tags: result.metadata.tags,
            metadata: {
              author: result.metadata.author,
              createdAt: result.metadata.createdAt,
              updatedAt: result.metadata.updatedAt,
              source: result.metadata.source
            }
          }

          filteredResults.push({
            chunk,
            score: result.score,
            document
          })
        }
      }

      return filteredResults.sort((a, b) => b.score - a.score)

    } catch (error) {
      console.error('Error searching similar chunks:', error)
      throw new Error('Failed to search documents')
    }
  }

  /**
   * Generate RAG response using retrieved context
   */
  async generateRAGResponse(
    query: string,
    context: SearchResult[],
    model = 'gemini-2.5-flash-lite'
  ): Promise<string> {
    try {
      // Prepare context from search results
      const contextText = context
        .map((result, index) => 
          `[Document ${index + 1}: ${result.chunk.metadata.title}]\n${result.chunk.content}\n`
        )
        .join('\n')

      // Construct system prompt
      const systemPrompt = `You are an AI assistant that answers questions based on provided context. Use the following context to answer the user's question accurately and comprehensively.

Context:
${contextText}

Instructions:
- Answer based primarily on the provided context
- If the context doesn't contain enough information, clearly state what's missing
- Provide specific details and examples when available
- Cite which documents you're referencing
- Be concise but thorough
- If asked about implementation details, provide code examples when relevant`

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

      // Use Gemini 2.5 Flash for response generation
      if (model === 'gemini-2.5-flash-lite') {
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
              maxOutputTokens: 2048,
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              }
            ]
          })
        })

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status}`)
        }

        const data = await response.json()
        return data.candidates[0]?.content?.parts[0]?.text || 'No response generated'
      }

      // Fallback to Cloudflare AI
      const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages,
        max_tokens: 1024,
        temperature: 0.1
      })

      return response.response || 'No response generated'

    } catch (error) {
      console.error('Error generating RAG response:', error)
      throw new Error('Failed to generate response')
    }
  }

  /**
   * Complete RAG pipeline: search + generate
   */
  async query(
    userQuery: string,
    options: {
      maxResults?: number
      scoreThreshold?: number
      model?: string
    } = {}
  ): Promise<{
    answer: string
    sources: SearchResult[]
    query: string
  }> {
    const { maxResults = 5, scoreThreshold = 0.7, model = 'gemini-2.5-flash-lite' } = options

    try {
      // Step 1: Search for relevant chunks
      const searchResults = await this.searchSimilarChunks(userQuery, maxResults, scoreThreshold)
      
      if (searchResults.length === 0) {
        return {
          answer: "I couldn't find any relevant information in the knowledge base to answer your question. Please try rephrasing your question or ask about topics covered in the available documents.",
          sources: [],
          query: userQuery
        }
      }

      // Step 2: Generate response using retrieved context
      const answer = await this.generateRAGResponse(userQuery, searchResults, model)

      return {
        answer,
        sources: searchResults,
        query: userQuery
      }

    } catch (error) {
      console.error('Error in RAG query:', error)
      throw new Error('Failed to process query')
    }
  }

  /**
   * Ingest documents from R2 bucket into Vectorize
   */
  async ingestFromR2(): Promise<{
    success: boolean
    documentsProcessed: number
    errors: string[]
  }> {
    const errors: string[] = []
    let documentsProcessed = 0

    try {
      // Check if R2 binding is available
      if (!this.env.R2_DOCUMENTS) {
        throw new Error('R2_DOCUMENTS binding not available')
      }

      // List all objects in the R2 bucket
      const bucket = this.env.R2_DOCUMENTS
      const objects = await bucket.list()
      
      console.log(`Found ${objects.objects.length} objects in R2 bucket`)

      // Process each markdown file
      for (const object of objects.objects) {
        if (object.key.endsWith('.md')) {
          try {
            console.log(`Processing R2 document: ${object.key}`)
            
            // Get the object from R2
            const r2Object = await bucket.get(object.key)
            if (!r2Object) {
              errors.push(`Could not retrieve ${object.key} from R2`)
              continue
            }

            // Read the content
            const content = await r2Object.text()
            
            // Parse frontmatter and content
            const lines = content.split('\n')
            let title = object.key.replace('.md', '').replace(/-/g, ' ')
            let category = 'General'
            let tags: string[] = []
            let author = 'Unknown'
            let source = 'R2 Document'
            let mainContent = content

            // Parse frontmatter if present
            if (lines[0] === '---') {
              const frontmatterEnd = lines.indexOf('---', 1)
              if (frontmatterEnd > 0) {
                const frontmatter = lines.slice(1, frontmatterEnd)
                mainContent = lines.slice(frontmatterEnd + 1).join('\n')
                
                // Parse frontmatter fields
                for (const line of frontmatter) {
                  if (line.startsWith('title:')) {
                    title = line.substring(6).trim()
                  } else if (line.startsWith('category:')) {
                    category = line.substring(9).trim()
                  } else if (line.startsWith('tags:')) {
                    const tagStr = line.substring(5).trim()
                    tags = tagStr.replace(/[\[\]]/g, '').split(',').map(t => t.trim())
                  } else if (line.startsWith('author:')) {
                    author = line.substring(7).trim()
                  } else if (line.startsWith('source:')) {
                    source = line.substring(7).trim()
                  }
                }
              }
            }

            // Create document object
            const document = {
              id: object.key.replace('.md', ''),
              title,
              content: mainContent,
              category,
              tags,
              metadata: {
                author,
                source,
                lastModified: object.uploaded.toISOString()
              }
            }

            // Ingest the document
            await this.ingestDocument(document)
            documentsProcessed++
            console.log(`Successfully ingested ${object.key}`)
            
          } catch (docError) {
            const errorMsg = `Failed to process ${object.key}: ${docError instanceof Error ? docError.message : 'Unknown error'}`
            console.error(errorMsg)
            errors.push(errorMsg)
          }
        }
      }

      return {
        success: errors.length === 0,
        documentsProcessed,
        errors
      }
      
    } catch (error) {
      console.error('Error ingesting from R2:', error)
      throw new Error(`Failed to ingest documents from R2: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}