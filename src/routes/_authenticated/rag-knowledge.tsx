import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Send, 
  Loader2, 
  Search as SearchIcon, 
  BookOpen, 
  Brain, 
  Database,
  Sparkles,
  FileText,
  MessageCircle,
  Settings,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  Target,
  Zap,
  Copy,
  ChevronDown,
  ChevronUp,
  Hash,
  TrendingUp,
  Activity,
  BarChart3
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/_authenticated/rag-knowledge')({
  component: RAGKnowledgePage,
})

interface SearchResult {
  content: string
  metadata: {
    source: string
    title?: string
    chunk_id: string
    score: number
    category?: string
    tags?: string[]
  }
}

interface RAGResponse {
  answer: string
  sources: SearchResult[]
  query: string
  metadata: {
    model: string
    responseTime: number
    searchResults: number
    avgScore: number
  }
  method: 'autorag' | 'custom'
}

interface RAGStatus {
  autorag: {
    available: boolean
    status: string
    documentsIndexed: number
  }
  custom: {
    available: boolean
    vectorize: boolean
    ai: boolean
  }
  models: {
    available: string[]
    default: string
  }
  sampleDocuments: {
    count: number
    categories: string[]
    totalTokensEstimate: number
  }
}

function RAGKnowledgePage() {
  const [query, setQuery] = useState('')
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-lite')
  const [useAutoRAG, setUseAutoRAG] = useState(true)
  const [searchOnly, setSearchOnly] = useState(false)
  const [lastResponse, setLastResponse] = useState<RAGResponse | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string, timestamp: Date, type: 'chat' | 'search', duration?: number }>>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [searchLimit, setSearchLimit] = useState(5)
  const [scoreThreshold, setScoreThreshold] = useState(0.7)
  const [temperature, setTemperature] = useState(0.1)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [comparisonResults, setComparisonResults] = useState<{ rag: RAGResponse, direct: any } | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  
  const queryClient = useQueryClient()

  // Fetch RAG system status
  const { data: status, isLoading: statusLoading } = useQuery<RAGStatus>({
    queryKey: ['rag-status'],
    queryFn: async () => {
      const response = await fetch('/api/rag/status')
      if (!response.ok) throw new Error('Failed to fetch status')
      const result = await response.json()
      return result.data
    }
  })

  // RAG query mutation
  const ragMutation = useMutation({
    mutationFn: async ({ query, searchOnly }: { query: string, searchOnly: boolean }) => {
      const startTime = Date.now()
      const endpoint = searchOnly ? '/api/rag/search' : '/api/rag/query'
      const method = searchOnly ? 'GET' : 'POST'
      
      let url = endpoint
      let body = undefined
      
      if (searchOnly) {
        const params = new URLSearchParams({ 
          query, 
          limit: searchLimit.toString(), 
          threshold: scoreThreshold.toString() 
        })
        url = `${endpoint}?${params}`
      } else {
        body = JSON.stringify({
          query,
          model: selectedModel,
          useAutoRAG,
          maxTokens,
          temperature,
          systemPrompt: systemPrompt.trim() || undefined
        })
      }
      
      const response = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body
      })
      
      if (!response.ok) throw new Error('RAG query failed')
      const result = await response.json()
      const duration = Date.now() - startTime
      return { ...result.data, duration }
    },
    onSuccess: (data) => {
      if (searchOnly) {
        setSearchResults(data.results || [])
        setLastResponse(null)
        toast.success(`Found ${data.results?.length || 0} relevant documents in ${data.duration}ms`)
      } else {
        setLastResponse(data)
        setSearchResults([])
        toast.success(`Response generated in ${data.duration}ms`)
      }
      // Add to query history
      setQueryHistory(prev => [
        { query: query.trim(), timestamp: new Date(), type: searchOnly ? 'search' : 'chat', duration: data.duration },
        ...prev.slice(0, 9) // Keep last 10 queries
      ])
    },
    onError: (error) => {
      toast.error(`Query failed: ${error.message}`)
    }
  })

  // Document ingestion mutation
  const ingestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useAutoRAG })
      })
      if (!response.ok) throw new Error('Ingestion failed')
      return await response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rag-status'] })
      toast.success(`Successfully ingested ${data.data?.documentsCount || 0} documents using ${data.data?.method || 'unknown'} method`)
    },
    onError: (error) => {
      toast.error(`Ingestion failed: ${error.message}`)
    }
  })

  const handleSubmit = () => {
    if (!query.trim()) return
    setSearchOnly(false) // Default to AI chat
    ragMutation.mutate({ query: query.trim(), searchOnly: false })
  }

  const handleSearch = () => {
    if (!query.trim()) return
    setSearchOnly(true)
    ragMutation.mutate({ query: query.trim(), searchOnly: true })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleCompareQuery = async () => {
    if (!query.trim()) return

    try {
      setIsComparing(true)
      setCompareError(null)
      setComparisonResults(null)
      
      // Execute both queries in parallel
      const [ragResponse, directResponse] = await Promise.all([
        fetch('/api/rag/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            model: selectedModel,
            temperature,
            maxTokens,
            systemPrompt,
            useAutoRAG: false // Force custom RAG for consistent comparison
          })
        }),
        fetch('/api/rag/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            model: selectedModel,
            temperature,
            maxTokens,
            systemPrompt
          })
        })
      ])

      if (!ragResponse.ok) throw new Error('RAG query failed')
      if (!directResponse.ok) throw new Error('Direct query failed')

      const ragData = await ragResponse.json()
      const directData = await directResponse.json()

      setComparisonResults({
        rag: ragData.data,
        direct: directData.data
      })

      // Add to query history
      setQueryHistory(prev => [...prev, {
        query: query.trim(),
        timestamp: new Date(),
        type: 'chat',
        duration: Math.max(ragData.data.metadata?.responseTime || 0, directData.data.metadata?.responseTime || 0)
      }])

      toast.success('Comparison completed successfully!')

    } catch (error) {
      console.error('Comparison error:', error)
      const errorMessage = 'Comparison failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      setCompareError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsComparing(false)
    }
  }

  const toggleSourceExpansion = (sourceId: string) => {
    const newExpanded = new Set(expandedSources)
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId)
    } else {
      newExpanded.add(sourceId)
    }
    setExpandedSources(newExpanded)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  const sampleQueries = [
    "How do I implement RAG with Cloudflare AutoRAG?",
    "What are the benefits of using Cloudflare Workers for serverless computing?",
    "Explain React TypeScript best practices for component development",
    "How does Cloudflare D1 database work with global replication?",
    "What embedding models are available in Cloudflare Workers AI?"
  ]

  return (
    <>
      <Header>
        <Search />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      
      <Main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            <h1 className="text-lg font-semibold md:text-2xl">RAG Knowledge Base</h1>
            <Badge variant="outline" className="ml-2">
              {status?.autorag.available ? 'AutoRAG' : 'Custom'} Powered
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => ingestMutation.mutate()}
              disabled={ingestMutation.isPending}
              variant="outline"
              size="sm"
            >
              {ingestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Ingest Sample Docs
            </Button>
          </div>
        </div>

        {statusLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading system status...
            </CardContent>
          </Card>
        ) : status && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Database className="h-4 w-4" />
                  AutoRAG Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {status.autorag.available ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <span className="text-sm">
                    {status.autorag.available ? 'Available' : 'Not Configured'}
                  </span>
                </div>
                {status.autorag.available && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {status.autorag.documentsIndexed} documents indexed
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  Knowledge Base
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Documents:</span>
                    <span className="font-mono">{status.sampleDocuments.count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Categories:</span>
                    <span className="font-mono">{status.sampleDocuments.categories.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Est. Tokens:</span>
                    <span className="font-mono">{status.sampleDocuments.totalTokensEstimate.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4" />
                  AI Models
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-sm">Available: {status.models.available.length}</div>
                  <div className="text-xs text-muted-foreground">
                    Default: {status.models.default}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="chat" className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <SearchIcon className="h-4 w-4" />
              Semantic Search
            </TabsTrigger>
            <TabsTrigger value="compare" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              RAG vs LLM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  RAG-Powered AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask questions about the knowledge base. The AI will search relevant documents and provide contextual answers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Configuration */}
                <div className="flex flex-wrap items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autorag-toggle"
                      checked={useAutoRAG}
                      onCheckedChange={setUseAutoRAG}
                      disabled={!status?.autorag.available}
                    />
                    <Label htmlFor="autorag-toggle" className="text-sm">
                      Use AutoRAG {!status?.autorag.available && '(Not Available)'}
                    </Label>
                  </div>
                  
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {status?.models.available.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    {showAdvanced ? 'Hide' : 'Show'} Advanced
                  </Button>
                </div>

                {/* Advanced Configuration Panel */}
                {showAdvanced && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Advanced Configuration</span>
                    </div>
                    
                    {/* System Prompt */}
                    <div className="space-y-2">
                      <Label htmlFor="system-prompt" className="text-sm font-medium">System Prompt</Label>
                      <Textarea
                        id="system-prompt"
                        placeholder="Enter custom system prompt to guide AI responses..."
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="min-h-20 text-xs"
                      />
                    </div>
                    
                    {/* Parameters Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="search-limit" className="text-xs">Search Limit</Label>
                        <Input
                          id="search-limit"
                          type="number"
                          min="1"
                          max="20"
                          value={searchLimit}
                          onChange={(e) => setSearchLimit(parseInt(e.target.value) || 5)}
                          className="text-xs h-8"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label htmlFor="score-threshold" className="text-xs">Score Threshold</Label>
                        <Input
                          id="score-threshold"
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={scoreThreshold}
                          onChange={(e) => setScoreThreshold(parseFloat(e.target.value) || 0.7)}
                          className="text-xs h-8"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label htmlFor="temperature" className="text-xs">Temperature</Label>
                        <Input
                          id="temperature"
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.1)}
                          className="text-xs h-8"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label htmlFor="max-tokens" className="text-xs">Max Tokens</Label>
                        <Input
                          id="max-tokens"
                          type="number"
                          min="100"
                          max="8192"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
                          className="text-xs h-8"
                        />
                      </div>
                    </div>
                    
                    {/* Quick System Prompt Presets */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Quick Presets:</Label>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { name: 'Technical', prompt: 'You are a technical expert. Provide detailed, precise answers with code examples where relevant.' },
                          { name: 'Beginner', prompt: 'You are helping a beginner. Use simple language and explain technical concepts step by step.' },
                          { name: 'Concise', prompt: 'Provide concise, direct answers. Focus on the essential information only.' },
                          { name: 'Creative', prompt: 'Be creative and engaging in your responses. Use analogies and examples to explain concepts.' }
                        ].map((preset) => (
                          <Button
                            key={preset.name}
                            variant="outline"
                            size="sm"
                            onClick={() => setSystemPrompt(preset.prompt)}
                            className="text-xs h-6"
                          >
                            {preset.name}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSystemPrompt('')}
                          className="text-xs h-6"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Query Input */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Ask a question about the knowledge base..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="min-h-20"
                  />
                  
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap gap-1">
                      {sampleQueries.slice(0, 3).map((sample, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => setQuery(sample)}
                          className="text-xs h-6"
                        >
                          {sample.substring(0, 30)}...
                        </Button>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleSearch}
                        disabled={!query.trim() || ragMutation.isPending}
                        size="sm"
                        variant="outline"
                      >
                        {ragMutation.isPending && searchOnly ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SearchIcon className="h-4 w-4" />
                        )}
                        Search
                      </Button>
                      
                      <Button 
                        onClick={handleSubmit}
                        disabled={!query.trim() || ragMutation.isPending}
                        size="sm"
                      >
                        {ragMutation.isPending && !searchOnly ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Ask
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Results */}
                {ragMutation.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {ragMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}

                {lastResponse && (
                  <div className="space-y-4">
                    {/* Answer */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Brain className="h-4 w-4" />
                            AI Response
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(lastResponse.answer)}
                              className="h-6 px-2"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Badge variant="secondary" className="text-xs">
                              {lastResponse.method}
                            </Badge>
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {lastResponse.duration || lastResponse.metadata.responseTime || 0}ms
                            </Badge>
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {lastResponse.sources?.length || 0} sources
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none">
                          {lastResponse.answer.split('\n').map((paragraph, index) => (
                            <p key={index} className="mb-2 last:mb-0">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Sources */}
                    {lastResponse.sources.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <BookOpen className="h-4 w-4" />
                            Sources ({lastResponse.sources.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {lastResponse.sources.map((source, index) => {
                              const chunkId = source.chunk?.id || source.metadata?.chunk_id || `source-${index}`
                              const isExpanded = expandedSources.has(chunkId)
                              return (
                                <div key={chunkId} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                      <Hash className="h-3 w-3 text-muted-foreground" />
                                      {source.metadata?.title || source.chunk?.metadata?.title || source.metadata?.source || source.chunk?.metadata?.source || 'Unknown Source'}
                                    </h4>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(source.content || source.chunk?.content || '')}
                                        className="h-6 px-2"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleSourceExpansion(chunkId)}
                                        className="h-6 px-2"
                                      >
                                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                      </Button>
                                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        {(source.score || source.metadata?.score || 0).toFixed(3)}
                                      </Badge>
                                      {(source.metadata?.category || source.chunk?.metadata?.category) && (
                                        <Badge variant="secondary" className="text-xs">
                                          {source.metadata?.category || source.chunk?.metadata?.category}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className={isExpanded ? '' : 'line-clamp-3'}>
                                    <p className="text-sm text-foreground whitespace-pre-wrap">
                                      {source.content || source.chunk?.content || 'No content available'}
                                    </p>
                                  </div>
                                  {(source.metadata?.tags || source.chunk?.metadata?.tags) && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {(source.metadata?.tags || source.chunk?.metadata?.tags || []).map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {chunkId && chunkId !== `source-${index}` && (
                                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                                      <span>Chunk ID: {chunkId}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SearchIcon className="h-5 w-5" />
                  Semantic Document Search
                </CardTitle>
                <CardDescription>
                  Search the knowledge base using semantic similarity. No AI response generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Search documents by meaning, not just keywords..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                  />
                  
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap gap-1">
                      {['Cloudflare Workers', 'React patterns', 'Vector databases', 'AutoRAG setup'].map((sample) => (
                        <Button
                          key={sample}
                          variant="outline"
                          size="sm"
                          onClick={() => setQuery(sample)}
                          className="text-xs h-6"
                        >
                          {sample}
                        </Button>
                      ))}
                    </div>
                    
                    <Button 
                      onClick={handleSearch}
                      disabled={!query.trim() || ragMutation.isPending}
                      size="sm"
                    >
                      {ragMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SearchIcon className="h-4 w-4" />
                      )}
                      Search
                    </Button>
                  </div>
                </div>

                {ragMutation.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {ragMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Search Results ({searchResults.length})</h3>
                    </div>
                    
                    {searchResults.map((result, index) => (
                      <Card key={result.metadata.chunk_id}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">
                              {result.metadata.title || result.metadata.source}
                            </h4>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {(result.metadata.score * 100).toFixed(1)}% match
                              </Badge>
                              {result.metadata.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {result.metadata.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {result.content}
                          </p>
                          {result.metadata.tags && (
                            <div className="flex flex-wrap gap-1">
                              {result.metadata.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compare" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  RAG vs Direct LLM Comparison
                </CardTitle>
                <CardDescription>
                  Test the same query with RAG-enhanced responses versus direct LLM responses to see the difference our specialized NASA dataset makes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Ask a question to compare RAG vs Direct LLM responses..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCompareQuery()
                      }
                    }}
                  />
                  
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setQuery('What are the main challenges for human Mars missions?')}
                      >
                        Mars missions
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setQuery('How does crew size affect Mars mission planning?')}
                      >
                        Crew planning
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setQuery('What is ISRU and why is it important?')}
                      >
                        ISRU technology
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setQuery('What are the radiation challenges in space?')}
                      >
                        Space radiation
                      </Button>
                    </div>
                    <Button 
                      onClick={handleCompareQuery}
                      disabled={!query.trim() || isComparing}
                      className="ml-4"
                    >
                      {isComparing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                      Compare
                    </Button>
                  </div>
                </div>

                {compareError && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{compareError}</AlertDescription>
                  </Alert>
                )}

                {/* Comparison Results - Side by Side */}
                {comparisonResults && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    {/* RAG Response */}
                    <Card className="border-green-200 dark:border-green-900">
                      <CardHeader className="bg-green-50 dark:bg-green-950">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Brain className="h-5 w-5 text-green-600" />
                            RAG-Enhanced Response
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {comparisonResults.rag.metadata.responseTime}ms
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="secondary">{comparisonResults.rag.method}</Badge>
                          <div className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {comparisonResults.rag.sources?.length || 0} sources
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="prose max-w-none text-sm">
                          {comparisonResults.rag.answer.split('\n').map((paragraph, index) => (
                            paragraph.trim() && (
                              <p key={index} className="mb-3 last:mb-0">
                                {paragraph}
                              </p>
                            )
                          ))}
                        </div>
                        
                        {comparisonResults.rag.sources && comparisonResults.rag.sources.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              Sources Used ({comparisonResults.rag.sources.length})
                            </h4>
                            <div className="space-y-2">
                              {comparisonResults.rag.sources.slice(0, 2).map((source, index) => (
                                <div key={index} className="p-2 bg-muted rounded text-xs">
                                  <div className="font-medium">{source.metadata?.title || source.title || 'Unknown Source'}</div>
                                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                    <Target className="h-3 w-3" />
                                    Score: {Math.round((source.metadata?.score || source.score || 0) * 100)}%
                                    <Badge variant="outline" className="ml-auto">
                                      {source.metadata?.category || source.category || 'Unknown'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Direct LLM Response */}
                    <Card className="border-blue-200 dark:border-blue-900">
                      <CardHeader className="bg-blue-50 dark:bg-blue-950">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-600" />
                            Direct LLM Response
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {comparisonResults.direct.metadata.responseTime}ms
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="secondary">{comparisonResults.direct.method}</Badge>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Database className="h-3 w-3" />
                            Training data only
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="prose max-w-none text-sm">
                          {comparisonResults.direct.answer.split('\n').map((paragraph, index) => (
                            paragraph.trim() && (
                              <p key={index} className="mb-3 last:mb-0">
                                {paragraph}
                              </p>
                            )
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Analysis Summary */}
                {comparisonResults && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Comparison Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="font-bold text-2xl text-green-600">
                            {comparisonResults.rag.sources?.length || 0}
                          </div>
                          <div className="text-sm text-muted-foreground">Sources Retrieved</div>
                          <div className="text-xs mt-1">RAG has specific document references</div>
                        </div>
                        
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="font-bold text-2xl">
                            {Math.abs(comparisonResults.rag.metadata.responseTime - comparisonResults.direct.metadata.responseTime)}ms
                          </div>
                          <div className="text-sm text-muted-foreground">Response Time Difference</div>
                          <div className="text-xs mt-1">
                            {comparisonResults.rag.metadata.responseTime < comparisonResults.direct.metadata.responseTime 
                              ? 'RAG was faster' 
                              : 'Direct was faster'}
                          </div>
                        </div>
                        
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <div className="font-bold text-2xl text-blue-600">
                            {comparisonResults.rag.answer.length > comparisonResults.direct.answer.length ? '📈' : '📊'}
                          </div>
                          <div className="text-sm text-muted-foreground">Response Detail</div>
                          <div className="text-xs mt-1">
                            RAG: {comparisonResults.rag.answer.length} chars vs Direct: {comparisonResults.direct.answer.length} chars
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 rounded-lg">
                        <h4 className="font-semibold mb-2">Key Differences:</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          <li>• <strong>RAG Response:</strong> Uses our specialized NASA/space physics dataset for technical accuracy</li>
                          <li>• <strong>Direct LLM:</strong> Relies only on general training data, may lack specific technical details</li>
                          <li>• <strong>Sources:</strong> RAG provides verifiable references to actual NASA documents and research papers</li>
                          <li>• <strong>Accuracy:</strong> RAG responses include precise technical specifications and current mission data</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Query History & Advanced Metrics */}
        {queryHistory.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Query History
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced
                  {showAdvanced ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {queryHistory.slice(0, showAdvanced ? 10 : 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant={item.type === 'chat' ? 'default' : 'secondary'} className="text-xs">
                        {item.type}
                      </Badge>
                      <span className="truncate">{item.query}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.duration && (
                        <Badge variant="outline" className="text-xs">
                          {item.duration}ms
                        </Badge>
                      )}
                      <span>{item.timestamp.toLocaleTimeString()}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setQuery(item.query)}
                        className="h-6 px-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {showAdvanced && queryHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="font-medium text-lg">
                        {queryHistory.length}
                      </div>
                      <div className="text-muted-foreground">Total Queries</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="font-medium text-lg">
                        {queryHistory.filter(q => q.duration).reduce((sum, q) => sum + (q.duration || 0), 0) / queryHistory.filter(q => q.duration).length || 0}ms
                      </div>
                      <div className="text-muted-foreground">Avg Response Time</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="font-medium text-lg">
                        {Math.round((queryHistory.filter(q => q.type === 'chat').length / queryHistory.length) * 100) || 0}%
                      </div>
                      <div className="text-muted-foreground">Chat vs Search</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}