import { type ReactNode, useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  children: string
  className?: string
}

interface CodeBlockProps {
  language?: string
  children: string
  className?: string
}

function CodeBlock({ language, children, className }: CodeBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (language === 'mermaid' && containerRef.current) {
      // Initialize mermaid with configuration
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit',
      })

      const renderMermaid = async () => {
        try {
          const { svg } = await mermaid.render(`mermaid-${Date.now()}`, children)
          if (containerRef.current) {
            containerRef.current.innerHTML = svg
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error)
          if (containerRef.current) {
            containerRef.current.innerHTML = `<pre class="text-red-500">Error rendering diagram: ${error}</pre>`
          }
        }
      }

      renderMermaid()
    }
  }, [language, children])

  if (language === 'mermaid') {
    return (
      <div 
        ref={containerRef}
        className={cn(
          'flex justify-center items-center p-4 bg-muted/30 rounded-lg border my-4',
          className
        )}
      >
        Loading diagram...
      </div>
    )
  }

  return (
    <pre className={cn('bg-muted p-4 rounded-lg overflow-x-auto text-sm', className)}>
      <code className={language ? `language-${language}` : ''}>{children}</code>
    </pre>
  )
}

export function Markdown({ children, className }: MarkdownProps) {
  const processMarkdown = (content: string): ReactNode[] => {
    const parts: ReactNode[] = []
    let currentIndex = 0

    // Regular expressions for markdown elements
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const inlineCodeRegex = /`([^`]+)`/g
    const boldRegex = /\*\*([^*]+)\*\*/g
    const italicRegex = /\*([^*]+)\*/g
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const headerRegex = /^(#{1,6})\s+(.+)$/gm
    const listItemRegex = /^[\s]*[-*+]\s+(.+)$/gm
    const numberedListRegex = /^[\s]*\d+\.\s+(.+)$/gm

    // Find all code blocks first
    const codeBlocks: Array<{ start: number; end: number; language?: string; content: string }> = []
    let match
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        start: match.index!,
        end: match.index! + match[0].length,
        language: match[1],
        content: match[2]
      })
    }

    // Sort code blocks by position
    codeBlocks.sort((a, b) => a.start - b.start)

    // Process content, handling code blocks specially
    let textParts: string[] = []
    let lastIndex = 0

    codeBlocks.forEach((block, index) => {
      // Add text before this code block
      if (block.start > lastIndex) {
        textParts.push(content.substring(lastIndex, block.start))
      }
      
      // Process the text part if it exists
      if (textParts.length > 0) {
        const textContent = textParts.join('')
        if (textContent.trim()) {
          parts.push(
            <div key={`text-${index}`} className="whitespace-pre-wrap">
              {processInlineMarkdown(textContent)}
            </div>
          )
        }
        textParts = []
      }

      // Add the code block
      parts.push(
        <CodeBlock
          key={`code-${index}`}
          language={block.language}
        >
          {block.content}
        </CodeBlock>
      )

      lastIndex = block.end
    })

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex)
      if (remainingText.trim()) {
        parts.push(
          <div key="remaining-text" className="whitespace-pre-wrap">
            {processInlineMarkdown(remainingText)}
          </div>
        )
      }
    }

    // If no code blocks, process all as inline markdown
    if (codeBlocks.length === 0) {
      parts.push(
        <div key="all-text" className="whitespace-pre-wrap">
          {processInlineMarkdown(content)}
        </div>
      )
    }

    return parts
  }

  const processInlineMarkdown = (content: string): ReactNode => {
    // This is a simplified inline markdown processor
    // You could extend this or use a proper markdown parser
    
    let processed = content
    
    // Replace headers
    processed = processed.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
      const level = hashes.length
      const tag = `h${level}`
      const classes = {
        1: 'text-2xl font-bold mb-4 mt-6',
        2: 'text-xl font-bold mb-3 mt-5',
        3: 'text-lg font-bold mb-2 mt-4',
        4: 'text-base font-bold mb-2 mt-3',
        5: 'text-sm font-bold mb-1 mt-2',
        6: 'text-xs font-bold mb-1 mt-2'
      }
      return `<${tag} class="${classes[level as keyof typeof classes]}">${text}</${tag}>`
    })

    // Replace bold text
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>')
    
    // Replace italic text  
    processed = processed.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
    
    // Replace inline code
    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    
    // Replace links
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-500 hover:text-blue-700 underline" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Replace list items
    processed = processed.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="ml-4">• $1</li>')
    processed = processed.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="ml-4">$1</li>')

    return <div dangerouslySetInnerHTML={{ __html: processed }} />
  }

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      {processMarkdown(children)}
    </div>
  )
}