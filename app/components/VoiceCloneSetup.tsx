import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import VoiceRecorder from './VoiceRecorder'
import VoiceMessage from './VoiceMessage'
import { useToast } from '@/components/ui/use-toast'
import { getSupabase } from '@/app/auth'
import { X, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

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
      router.refresh()
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
    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Mic className="w-5 h-5 text-muted-foreground" />
          Create Your Voice Clone
        </h2>
      </div>

      <div className="bg-muted/50 p-3 rounded-lg space-y-2">
        <h3 className="font-medium">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Find a quiet place with minimal background noise</li>
          <li>Click the microphone button and read the text out loud clearly</li>
          <li>Try to maintain a natural speaking pace and tone</li>
          <li>You can preview your recording and re-record if needed</li>
          <li>Complete both recordings to create your voice clone</li>
        </ol>
      </div>

      <div className="mb-2">
        <p className="text-sm text-muted-foreground">
          Progress: {recordings.filter(r => r !== null).length} of {texts.length} recordings completed
        </p>
      </div>

      <div className="space-y-2">
        {texts.map((text, index) => {
          const isDisabled = index > 0 && !recordings[index - 1];
          const isCompleted = recordings[index] !== null;
          return (
            <div 
              key={index} 
              className={`p-3 rounded-lg border-2 ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : isCompleted
                    ? 'bg-background border-muted'
                    : 'bg-primary/5 border-primary'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recording {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <VoiceRecorder
                      onRecordingComplete={(blob, duration) => {
                        handleRecordingComplete(blob, duration)
                        if (index < texts.length - 1) {
                          setCurrentStep(index + 1)
                        }
                      }}
                      onCancel={() => handleCancel(index)}
                      className="w-10 h-10"
                      disabled={isDisabled}
                    />
                    <span className="text-sm text-muted-foreground">
                      {recordings[index] ? "Re-record" : "Record"}
                    </span>
                  </div>
                </div>

                <div className={`bg-muted p-3 rounded-md ${isDisabled ? 'opacity-50' : ''}`}>
                  <p className="text-lg">{text}</p>
                </div>

                {recordings[index] && (
                  <div className="flex items-center gap-2">
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
                      disabled={isDisabled}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button 
        onClick={createVoiceClone} 
        disabled={isSubmitting || recordings.filter(r => r !== null).length !== texts.length}
        className="w-full"
      >
        {isSubmitting ? "Creating Voice Clone..." : "Create Voice Clone"}
      </Button>
    </div>
  )
} 