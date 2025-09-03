import type { Artifact, ArtifactType } from '@/types/artifacts'

interface ParsedArtifact {
  title: string
  description?: string
  type: ArtifactType
  content: string
  language?: string
}

// Regex patterns for detecting artifacts in AI responses
const ARTIFACT_PATTERNS = {
  codeBlock: /```(\w+)?\s*([\s\S]*?)```/g,
  reactComponent: /```(?:tsx?|react|jsx)\s*([\s\S]*?)```/g,
  htmlBlock: /```html\s*([\s\S]*?)```/g,
  cssBlock: /```css\s*([\s\S]*?)```/g,
  jsonBlock: /```json\s*([\s\S]*?)```/g,
  svgBlock: /```svg\s*([\s\S]*?)```/g,
  markdownBlock: /```(?:md|markdown)\s*([\s\S]*?)```/g,
}

// Language to artifact type mapping
const LANGUAGE_TYPE_MAP: Record<string, ArtifactType> = {
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'tsx': 'react-component',
  'jsx': 'react-component',
  'react': 'react-component',
  'html': 'html',
  'css': 'css',
  'json': 'json',
  'svg': 'svg',
  'xml': 'svg',
  'markdown': 'markdown',
  'md': 'markdown',
}

// Keywords that suggest artifact creation intent
const ARTIFACT_INTENT_KEYWORDS = [
  'create a component',
  'build a',
  'make a',
  'generate',
  'show me a',
  'create an html',
  'create a react',
  'build an interface',
  'design a',
  'code a',
  'implement a',
  'write a function',
  'create a chart',
  'build a form',
  'create',
  'build',
  'write',
  'implement',
  'develop',
  'design',
  'make',
  'generate code',
  'create component',
  'build component'
]

export function parseArtifactsFromContent(content: string, messageId?: string): Artifact[] {
  const artifacts: Artifact[] = []
  const codeBlocks = extractCodeBlocks(content)
  
  codeBlocks.forEach((block, index) => {
    const artifact = createArtifactFromCodeBlock(block, index, messageId)
    if (artifact) {
      artifacts.push(artifact)
    }
  })

  return artifacts
}

export function shouldCreateArtifact(userMessage: string, aiResponse: string): boolean {
  const hasCodeBlock = /```[\w]*\s*[\s\S]*?```/.test(aiResponse)
  const hasIntent = ARTIFACT_INTENT_KEYWORDS.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  )
  const isSubstantialCode = aiResponse.length > 150 && hasCodeBlock
  const hasMultipleCodeBlocks = (aiResponse.match(/```/g) || []).length >= 4 // At least 2 code blocks
  
  // More lenient for Gemini - create artifacts for any substantial code response
  return hasIntent || isSubstantialCode || hasMultipleCodeBlocks
}

function extractCodeBlocks(content: string) {
  const blocks: { language: string; content: string; fullMatch: string }[] = []
  const regex = /```(\w+)?\s*([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    const [fullMatch, language = '', codeContent] = match
    blocks.push({
      language: language.toLowerCase(),
      content: codeContent.trim(),
      fullMatch
    })
  }

  return blocks
}

function createArtifactFromCodeBlock(
  block: { language: string; content: string; fullMatch: string },
  index: number,
  messageId?: string
): Artifact | null {
  const { language, content } = block
  
  if (!content || content.length < 10) return null

  const type = LANGUAGE_TYPE_MAP[language] || 'code'
  const title = generateArtifactTitle(type, content, index)
  const description = generateArtifactDescription(type, content)

  return {
    id: `${messageId || 'artifact'}-${index}-${Date.now()}`,
    title,
    description,
    type,
    content,
    language: language || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function generateArtifactTitle(type: ArtifactType, content: string, index: number): string {
  // Try to extract meaningful names from the content
  switch (type) {
    case 'react-component': {
      const componentMatch = content.match(/(?:function|const|class)\s+(\w+)/i)
      if (componentMatch) return `${componentMatch[1]} Component`
      return `React Component ${index + 1}`
    }
    
    case 'javascript':
    case 'typescript': {
      const functionMatch = content.match(/(?:function|const|let|var)\s+(\w+)/i)
      if (functionMatch) return `${functionMatch[1]} Function`
      return `${type.charAt(0).toUpperCase() + type.slice(1)} Code ${index + 1}`
    }
    
    case 'html': {
      const titleMatch = content.match(/<title>(.*?)<\/title>/i)
      if (titleMatch) return titleMatch[1]
      const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
      if (h1Match) return h1Match[1].replace(/<[^>]*>/g, '')
      return `HTML Document ${index + 1}`
    }
    
    case 'css': {
      const classMatch = content.match(/\.(\w+)\s*\{/)
      if (classMatch) return `${classMatch[1]} Styles`
      return `CSS Styles ${index + 1}`
    }
    
    case 'svg': {
      return `SVG Graphics ${index + 1}`
    }
    
    case 'json': {
      try {
        const parsed = JSON.parse(content)
        if (parsed.name) return `${parsed.name} Configuration`
        if (parsed.title) return parsed.title
      } catch {}
      return `JSON Data ${index + 1}`
    }
    
    case 'markdown': {
      const h1Match = content.match(/^#\s+(.+)$/m)
      if (h1Match) return h1Match[1]
      return `Markdown Document ${index + 1}`
    }
    
    default:
      return `Code Snippet ${index + 1}`
  }
}

function generateArtifactDescription(type: ArtifactType, content: string): string {
  const lines = content.split('\n').length
  const chars = content.length
  
  switch (type) {
    case 'react-component':
      return `React component with ${lines} lines of code`
    case 'html':
      return `HTML document with ${lines} lines`
    case 'css':
      return `CSS styles with ${lines} lines`
    case 'javascript':
    case 'typescript':
      return `${type} code with ${lines} lines`
    case 'json':
      return `JSON data (${chars} characters)`
    case 'svg':
      return `SVG graphics code`
    case 'markdown':
      return `Markdown document with ${lines} lines`
    default:
      return `Code snippet with ${lines} lines`
  }
}

// Enhanced artifact detection for specific patterns
export function detectSpecialArtifacts(userMessage: string, aiResponse: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = []
  
  // Detect chart requests
  if (userMessage.match(/chart|graph|plot|visualization/i) && aiResponse.includes('```')) {
    const chartCode = extractCodeBlocks(aiResponse).find(block => 
      block.content.includes('chart') || block.content.includes('data')
    )
    if (chartCode) {
      artifacts.push({
        title: 'Data Visualization',
        description: 'Interactive chart or graph',
        type: 'chart',
        content: chartCode.content,
        language: chartCode.language
      })
    }
  }
  
  // Detect form requests
  if (userMessage.match(/form|input|submit|field/i)) {
    const formCode = extractCodeBlocks(aiResponse).find(block =>
      block.content.includes('form') || block.content.includes('input')
    )
    if (formCode) {
      artifacts.push({
        title: 'Form Component',
        description: 'Interactive form with inputs',
        type: formCode.language === 'html' ? 'html' : 'react-component',
        content: formCode.content,
        language: formCode.language
      })
    }
  }
  
  return artifacts
}