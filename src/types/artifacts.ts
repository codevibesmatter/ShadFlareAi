export interface Artifact {
  id: string
  title: string
  description?: string
  type: ArtifactType
  content: string
  language?: string
  createdAt: number
  updatedAt: number
  metadata?: Record<string, any>
}

export type ArtifactType = 
  | 'code' 
  | 'react-component' 
  | 'html'
  | 'css'
  | 'javascript'
  | 'typescript'
  | 'json'
  | 'markdown'
  | 'svg'
  | 'chart'
  | 'document'

export interface ArtifactMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
  artifacts?: Artifact[]
}

export interface ArtifactCreationRequest {
  type: ArtifactType
  title: string
  description?: string
  content: string
  language?: string
  metadata?: Record<string, any>
}

export interface ArtifactUpdateRequest {
  id: string
  title?: string
  description?: string
  content?: string
  metadata?: Record<string, any>
}