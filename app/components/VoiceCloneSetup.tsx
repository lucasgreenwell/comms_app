import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import VoiceRecorder from './VoiceRecorder'
import VoiceMessage from './VoiceMessage'
import { useToast } from '@/components/ui/use-toast'
import { getSupabase } from '@/app/auth'
import { X } from 'lucide-react'

const SAMPLE_TEXTS = {
  en: [
    "The quick brown fox jumps over the lazy dog. I love spending time outdoors, especially when the weather is nice.",
    "Life is like a box of chocolates, you never know what you're going to get. I enjoy trying new things and meeting new people."
  ],
  es: [
    "El rápido zorro marrón salta sobre el perro perezoso. Me encanta pasar tiempo al aire libre, especialmente cuando hace buen tiempo.",
    "La vida es como una caja de chocolates, nunca sabes lo que te va a tocar. Me gusta probar cosas nuevas y conocer gente nueva."
  ],
  // Add more languages as needed
}

interface VoiceCloneSetupProps {
  userId: string
  userLanguage: string
  onVoiceCreated: (voiceId: string) => void
}

interface Recording {
  blob: Blob
  url: string
  duration: number
}

export default function VoiceCloneSetup({ userId, userLanguage, onVoiceCreated }: VoiceCloneSetupProps) {
  const [recordings, setRecordings] = useState<(Recording | null)[]>([null, null])
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Default to English if the language isn't supported
  const texts = SAMPLE_TEXTS[userLanguage as keyof typeof SAMPLE_TEXTS] || SAMPLE_TEXTS.en

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    const url = URL.createObjectURL(blob)
    const newRecordings = [...recordings]
    newRecordings[currentStep] = { blob, url, duration }
    setRecordings(newRecordings)
    
    // If we have completed all recordings, don't auto-advance
    if (currentStep < texts.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleCancel = (index: number) => {
    const newRecordings = [...recordings]
    if (newRecordings[index]?.url) {
      URL.revokeObjectURL(newRecordings[index]!.url)
    }
    newRecordings[index] = null
    setRecordings(newRecordings)
    setCurrentStep(index)
  }

  const createVoiceClone = async () => {
    const completedRecordings = recordings.filter((r): r is Recording => r !== null)
    if (completedRecordings.length !== texts.length) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please complete all recordings first."
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Convert blobs to Files
      const files = completedRecordings.map((recording, index) => 
        new File([recording.blob], `sample_${index + 1}.mp3`, { type: 'audio/mp3' })
      )

      // Create FormData
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('name', `Voice_${userId}`)
      formData.append('description', 'Custom voice clone created from user recordings')

      // Call our API route
      const response = await fetch('/api/voice-clone', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail?.message || 'Failed to create voice clone')
      }

      const data = await response.json()
      const voiceId = data.voice_id

      // Save voice ID to user profile
      const supabase = getSupabase()
      const { error } = await supabase
        .from('users')
        .update({ eleven_labs_clone_id: voiceId })
        .eq('id', userId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Voice clone created successfully!"
      })

      onVoiceCreated(voiceId)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create voice clone. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Create Your Voice Clone</h2>
      <div className="space-y-4">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Progress: {recordings.filter(r => r !== null).length} of {texts.length} recordings completed
          </p>
        </div>

        <div>
          {texts.map((text, index) => (
            <div 
              key={index} 
              className={`p-4 mb-4 rounded-md ${
                index === currentStep 
                  ? 'bg-primary/10 border-2 border-primary' 
                  : 'bg-muted'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-lg flex-1">{text}</p>
                <div className="flex flex-col items-center">
                  <VoiceRecorder
                    onRecordingComplete={(blob, duration) => {
                      handleRecordingComplete(blob, duration)
                      if (index < texts.length - 1) {
                        setCurrentStep(index + 1)
                      }
                    }}
                    onCancel={() => handleCancel(index)}
                    className="w-10 h-10"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {recordings[index] 
                      ? "Re-record" 
                      : "Record"}
                  </p>
                </div>
              </div>
              {recordings[index] && (
                <div className="mt-4 flex items-center gap-2">
                  <VoiceMessage
                    bucket="voice-messages"
                    path=""
                    duration={recordings[index]!.duration}
                    previewUrl={recordings[index]!.url}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleCancel(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button 
          onClick={createVoiceClone} 
          disabled={isSubmitting || recordings.filter(r => r !== null).length !== texts.length}
          className="w-full"
        >
          {isSubmitting ? "Creating Voice Clone..." : "Create Voice Clone"}
        </Button>
      </div>
    </Card>
  )
} 