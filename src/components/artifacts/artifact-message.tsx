import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { ArtifactRenderer } from './artifact-renderer'
import { Response } from '@/components/response'
import type { ArtifactMessage } from '@/types/artifacts'
import { useState } from 'react'

interface ArtifactMessageProps {
  message: ArtifactMessage
  onEditArtifact?: (artifact: any) => void
  onDeleteArtifact?: (id: string) => void
}

export function ArtifactMessageComponent({ 
  message, 
  onEditArtifact, 
  onDeleteArtifact 
}: ArtifactMessageProps) {
  const [artifactsExpanded, setArtifactsExpanded] = useState(true)
  const hasArtifacts = message.artifacts && message.artifacts.length > 0

  return (
    <div className='space-y-3'>
      {/* Message content */}
      <div>
        <Response enableCodeBlocks={true}>{message.content}</Response>
      </div>
      
      {/* Artifacts section */}
      {hasArtifacts && (
        <div className='border-t pt-3'>
          <Collapsible open={artifactsExpanded} onOpenChange={setArtifactsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='flex items-center gap-2 p-0 h-auto font-medium'>
                {artifactsExpanded ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronRight className='h-4 w-4' />
                )}
                <Sparkles className='h-4 w-4 text-purple-500' />
                <span>Artifacts</span>
                <Badge variant='secondary' className='text-xs'>
                  {message.artifacts!.length}
                </Badge>
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className='mt-3 space-y-4'>
              {message.artifacts!.map((artifact) => (
                <ArtifactRenderer
                  key={artifact.id}
                  artifact={artifact}
                  onEdit={onEditArtifact}
                  onDelete={onDeleteArtifact}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  )
}