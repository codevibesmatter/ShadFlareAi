import { useState, useCallback } from 'react'
import type { Artifact, ArtifactCreationRequest, ArtifactUpdateRequest } from '@/types/artifacts'

interface UseArtifactsReturn {
  artifacts: Artifact[]
  createArtifact: (request: ArtifactCreationRequest) => Artifact
  updateArtifact: (request: ArtifactUpdateRequest) => void
  deleteArtifact: (id: string) => void
  getArtifact: (id: string) => Artifact | undefined
  clearArtifacts: () => void
}

export function useArtifacts(): UseArtifactsReturn {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  const createArtifact = useCallback((request: ArtifactCreationRequest): Artifact => {
    const artifact: Artifact = {
      id: crypto.randomUUID(),
      title: request.title,
      description: request.description,
      type: request.type,
      content: request.content,
      language: request.language,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: request.metadata
    }

    setArtifacts(prev => [...prev, artifact])
    return artifact
  }, [])

  const updateArtifact = useCallback((request: ArtifactUpdateRequest) => {
    setArtifacts(prev => prev.map(artifact => 
      artifact.id === request.id
        ? {
            ...artifact,
            ...(request.title && { title: request.title }),
            ...(request.description && { description: request.description }),
            ...(request.content && { content: request.content }),
            ...(request.metadata && { metadata: { ...artifact.metadata, ...request.metadata } }),
            updatedAt: Date.now()
          }
        : artifact
    ))
  }, [])

  const deleteArtifact = useCallback((id: string) => {
    setArtifacts(prev => prev.filter(artifact => artifact.id !== id))
  }, [])

  const getArtifact = useCallback((id: string) => {
    return artifacts.find(artifact => artifact.id === id)
  }, [artifacts])

  const clearArtifacts = useCallback(() => {
    setArtifacts([])
  }, [])

  return {
    artifacts,
    createArtifact,
    updateArtifact,
    deleteArtifact,
    getArtifact,
    clearArtifacts
  }
}