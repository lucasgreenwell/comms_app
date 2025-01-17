import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import VoiceRecorder from '@/app/components/VoiceRecorder'
import { useToast } from '@/components/ui/use-toast'
import { getSupabase } from '@/app/auth'

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

export default function VoiceCloneSetup({ userId, userLanguage, onVoiceCreated }: VoiceCloneSetupProps) {
  const [recordings, setRecordings] = useState<Blob[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Default to English if the language isn't supported
  const texts = SAMPLE_TEXTS[userLanguage as keyof typeof SAMPLE_TEXTS] || SAMPLE_TEXTS.en

  const handleRecordingComplete = (blob: Blob) => {
    const newRecordings = [...recordings, blob]
    setRecordings(newRecordings)
    
    if (newRecordings.length < texts.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleCancel = () => {
    if (currentStep > 0) {
      setRecordings(recordings.slice(0, -1))
      setCurrentStep(currentStep - 1)
    }
  }

  const createVoiceClone = async () => {
    if (recordings.length !== texts.length) {
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
      const files = recordings.map((blob, index) => 
        new File([blob], `sample_${index + 1}.mp3`, { type: 'audio/mp3' })
      )

      // Create FormData
      const formData = new FormData()
      files.forEach(file => formData.append('files[]', file))
      formData.append('name', `Voice_${userId}`)
      formData.append('description', 'Custom voice clone created from user recordings')

      // Call ElevenLabs API
      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || ''
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to create voice clone')
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
      console.error('Error creating voice clone:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create voice clone. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Create Your Voice Clone</h2>
      <div className="space-y-4">
        {currentStep < texts.length ? (
          <div>
            <p className="mb-4">
              Recording {currentStep + 1} of {texts.length}. Please read the following text:
            </p>
            <div className="p-4 bg-muted rounded-md mb-4">
              <p className="text-lg">{texts[currentStep]}</p>
            </div>
            <VoiceRecorder
              onRecordingComplete={handleRecordingComplete}
              onCancel={handleCancel}
            />
          </div>
        ) : (
          <div>
            <p className="mb-4">All recordings complete! Ready to create your voice clone.</p>
            <Button 
              onClick={createVoiceClone} 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Creating Voice Clone..." : "Create Voice Clone"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
} 