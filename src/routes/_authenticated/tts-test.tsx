import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Volume2, Play, Pause, Loader2, Download } from 'lucide-react'
import { useState, useRef } from 'react'

function TTSTestPage() {
  const [text, setText] = useState('Hello, this is a test of the Cloudflare text-to-speech system using Aura-1.')
  const [selectedVoice, setSelectedVoice] = useState('@cf/deepgram/aura-1')
  const [selectedSpeaker, setSelectedSpeaker] = useState('angus')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const availableVoices = [
    { id: '@cf/deepgram/aura-1', name: 'Deepgram Aura-1' },
  ]

  const availableSpeakers = [
    { id: 'angus', name: 'Angus' },
    { id: 'stella', name: 'Stella' },
    { id: 'luna', name: 'Luna' },
    { id: 'helios', name: 'Helios' },
    { id: 'orion', name: 'Orion' },
    { id: 'arcas', name: 'Arcas' },
    { id: 'perseus', name: 'Perseus' },
    { id: 'hera', name: 'Hera' },
    { id: 'zeus', name: 'Zeus' }
  ]

  const generateAudio = async () => {
    if (!text.trim()) {
      setError('Please enter some text to convert to speech')
      return
    }

    setIsGenerating(true)
    setError(null)
    setAudioUrl(null)

    try {
      console.log('🗣️ Generating TTS audio...')
      
      const response = await fetch('/api/tts-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
          speaker: selectedSpeaker,
          encoding: 'wav',
          sample_rate: 16000
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate audio')
      }

      // Get the audio data as a blob
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      setAudioUrl(audioUrl)
      
      console.log('✅ Audio generated successfully')
    } catch (error) {
      console.error('❌ TTS Error:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate audio')
    } finally {
      setIsGenerating(false)
    }
  }

  const playAudio = () => {
    if (!audioUrl || !audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const downloadAudio = () => {
    if (!audioUrl) return
    
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = `tts-output-${Date.now()}.mp3`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className='flex h-full'>
      <Main className='flex-1'>
        <Header sticky>
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>

        <div className='container mx-auto p-6 space-y-8'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold'>Text-to-Speech Testing</h1>
            <p className='text-muted-foreground'>
              Test Cloudflare's text-to-speech capabilities using Aura-1 voice synthesis
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Volume2 className='h-5 w-5' />
                TTS Configuration
              </CardTitle>
              <CardDescription>
                Configure and test text-to-speech generation
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Voice Selection */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='voice-select'>Voice Model</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select voice model' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='speaker-select'>Speaker</Label>
                  <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select speaker' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSpeakers.map((speaker) => (
                        <SelectItem key={speaker.id} value={speaker.id}>
                          {speaker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Text Input */}
              <div className='space-y-2'>
                <Label htmlFor='text-input'>Text to Convert</Label>
                <Textarea
                  id='text-input'
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder='Enter the text you want to convert to speech...'
                  rows={4}
                  className='resize-none'
                />
                <div className='text-sm text-muted-foreground'>
                  {text.length} characters
                </div>
              </div>

              {/* Generate Button */}
              <Button 
                onClick={generateAudio} 
                disabled={isGenerating || !text.trim()}
                className='w-full'
              >
                {isGenerating ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating Audio...
                  </>
                ) : (
                  <>
                    <Volume2 className='mr-2 h-4 w-4' />
                    Generate Speech
                  </>
                )}
              </Button>

              {/* Error Display */}
              {error && (
                <div className='bg-red-50 border border-red-200 rounded-lg p-3'>
                  <div className='text-red-700 text-sm'>
                    <strong>Error:</strong> {error}
                  </div>
                </div>
              )}

              {/* Audio Player */}
              {audioUrl && (
                <div className='bg-green-50 border border-green-200 rounded-lg p-4 space-y-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-green-700 font-medium'>Audio Generated Successfully</span>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={playAudio}
                      >
                        {isPlaying ? (
                          <Pause className='h-4 w-4' />
                        ) : (
                          <Play className='h-4 w-4' />
                        )}
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={downloadAudio}
                      >
                        <Download className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                  
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    controls
                    className='w-full'
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample Texts */}
          <Card>
            <CardHeader>
              <CardTitle>Sample Texts</CardTitle>
              <CardDescription>
                Click any sample to test different types of content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                {[
                  'Hello, this is a test of the Cloudflare text-to-speech system.',
                  'The quick brown fox jumps over the lazy dog.',
                  'Welcome to our voice AI demonstration. This technology can convert any text into natural-sounding speech.',
                  'In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole filled with the ends of worms and an oozy smell.',
                  'To be or not to be, that is the question. Whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune.',
                  'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.',
                ].map((sample, index) => (
                  <Button
                    key={index}
                    variant='outline'
                    className='h-auto p-3 text-left justify-start'
                    onClick={() => setText(sample)}
                  >
                    <div className='text-sm text-wrap'>{sample}</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/tts-test')({
  component: TTSTestPage,
})