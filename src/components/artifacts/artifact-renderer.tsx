import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Code, 
  Eye, 
  Copy, 
  Download, 
  Edit, 
  FileCode, 
  FileText, 
  Image, 
  BarChart3,
  Globe,
  Palette
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Artifact } from '@/types/artifacts'

interface ArtifactRendererProps {
  artifact: Artifact
  onEdit?: (artifact: Artifact) => void
  onDelete?: (id: string) => void
  className?: string
}

const getArtifactIcon = (type: string) => {
  switch (type) {
    case 'code':
    case 'javascript':
    case 'typescript':
      return <FileCode className='h-4 w-4' />
    case 'react-component':
      return <Code className='h-4 w-4' />
    case 'html':
      return <Globe className='h-4 w-4' />
    case 'css':
      return <Palette className='h-4 w-4' />
    case 'svg':
      return <Image className='h-4 w-4' />
    case 'chart':
      return <BarChart3 className='h-4 w-4' />
    case 'markdown':
    case 'document':
      return <FileText className='h-4 w-4' />
    default:
      return <FileCode className='h-4 w-4' />
  }
}

const getLanguageForHighlighting = (type: string, language?: string) => {
  if (language) return language
  
  switch (type) {
    case 'javascript':
      return 'javascript'
    case 'typescript':
      return 'typescript'
    case 'react-component':
      return 'tsx'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'json':
      return 'json'
    case 'markdown':
      return 'markdown'
    case 'svg':
      return 'xml'
    default:
      return 'text'
  }
}

export function ArtifactRenderer({ 
  artifact, 
  onEdit, 
  onDelete,
  className 
}: ArtifactRendererProps) {
  const [activeTab, setActiveTab] = useState('preview')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content)
  }

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${artifact.title}.${artifact.language || 'txt'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderPreview = () => {
    switch (artifact.type) {
      case 'html':
        return (
          <div className='border rounded-lg bg-white dark:bg-gray-900'>
            <iframe
              srcDoc={artifact.content}
              className='w-full h-64 border-0 rounded-lg'
              sandbox='allow-scripts allow-same-origin'
              title={artifact.title}
            />
          </div>
        )

      case 'react-component':
        // For React components, show a code preview since we can't safely execute them
        return (
          <div className='space-y-2'>
            <p className='text-sm text-muted-foreground'>
              React component preview (code only - execution requires proper setup)
            </p>
            <SyntaxHighlighter
              language='tsx'
              style={vscDarkPlus}
              className='rounded-lg'
              customStyle={{ margin: 0, fontSize: '14px' }}
            >
              {artifact.content}
            </SyntaxHighlighter>
          </div>
        )

      case 'svg':
        return (
          <div className='border rounded-lg p-4 bg-white dark:bg-gray-900 flex items-center justify-center'>
            <div dangerouslySetInnerHTML={{ __html: artifact.content }} />
          </div>
        )

      case 'markdown':
        // For now, show raw markdown - could integrate a markdown renderer later
        return (
          <div className='prose dark:prose-invert max-w-none'>
            <pre className='whitespace-pre-wrap text-sm'>{artifact.content}</pre>
          </div>
        )

      default:
        return (
          <SyntaxHighlighter
            language={getLanguageForHighlighting(artifact.type, artifact.language)}
            style={vscDarkPlus}
            className='rounded-lg'
            customStyle={{ margin: 0, fontSize: '14px' }}
          >
            {artifact.content}
          </SyntaxHighlighter>
        )
    }
  }

  return (
    <Card className={className} data-testid="artifact-card">
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              {getArtifactIcon(artifact.type)}
              <CardTitle className='text-lg'>{artifact.title}</CardTitle>
              <Badge variant='secondary' className='text-xs'>
                {artifact.type}
              </Badge>
            </div>
            {artifact.description && (
              <CardDescription>{artifact.description}</CardDescription>
            )}
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleCopy}
              className='h-8 w-8 p-0'
            >
              <Copy className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleDownload}
              className='h-8 w-8 p-0'
            >
              <Download className='h-4 w-4' />
            </Button>
            {onEdit && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => onEdit(artifact)}
                className='h-8 w-8 p-0'
              >
                <Edit className='h-4 w-4' />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='preview' className='flex items-center gap-2'>
              <Eye className='h-4 w-4' />
              Preview
            </TabsTrigger>
            <TabsTrigger value='code' className='flex items-center gap-2'>
              <Code className='h-4 w-4' />
              Code
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value='preview' className='mt-4'>
            <ScrollArea className='h-64 w-full'>
              {renderPreview()}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value='code' className='mt-4'>
            <ScrollArea className='h-64 w-full'>
              <SyntaxHighlighter
                language={getLanguageForHighlighting(artifact.type, artifact.language)}
                style={vscDarkPlus}
                className='rounded-lg'
                customStyle={{ margin: 0, fontSize: '14px' }}
              >
                {artifact.content}
              </SyntaxHighlighter>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}