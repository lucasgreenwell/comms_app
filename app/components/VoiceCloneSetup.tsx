import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import VoiceRecorder from './VoiceRecorder'
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

  useEffect(() => {
    console.log('VoiceCloneSetup State:', {
      currentStep,
      recordingsCount: recordings.length,
      totalRequired: texts.length,
      isSubmitting
    })
  }, [currentStep, recordings, isSubmitting, texts.length])

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    console.log('Recording completed:', {
      duration,
      blobSize: blob.size,
      currentRecordings: recordings.length,
      currentStep
    })

    const newRecordings = [...recordings, blob]
    setRecordings(newRecordings)
    
    console.log('After adding new recording:', {
      newRecordingsCount: newRecordings.length,
      requiredRecordings: texts.length,
      willAdvanceStep: true
    })
    
    // Always advance to next step, which will show the final screen when all recordings are done
    setCurrentStep(currentStep + 1)
  }

  const handleCancel = () => {
    console.log('Cancelling recording:', {
      currentStep,
      recordingsBeforeCancel: recordings.length
    })
    
    // Remove the last recording and go back a step
    setRecordings(recordings.slice(0, -1))
    setCurrentStep(Math.max(0, currentStep - 1))
    
    console.log('After cancel:', {
      newStep: Math.max(0, currentStep - 1),
      recordingsAfterCancel: recordings.length - 1
    })
  }

  const createVoiceClone = async () => {
    console.log('Starting voice clone creation:', {
      recordingsCount: recordings.length,
      requiredCount: texts.length,
      userId
    })

    if (recordings.length !== texts.length) {
      console.log('Recordings count mismatch:', {
        current: recordings.length,
        required: texts.length
      })
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
      const files = recordings.map((blob, index) => {
        const file = new File([blob], `sample_${index + 1}.mp3`, { type: 'audio/mp3' })
        console.log(`Created file ${index + 1}:`, {
          name: file.name,
          size: file.size,
          type: file.type
        })
        return file
      })

      // Create FormData
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('name', `Voice_${userId}`)
      formData.append('description', 'Custom voice clone created from user recordings')

      console.log('Sending request to voice clone API:', {
        filesCount: files.length,
        voiceName: `Voice_${userId}`
      })

      // Call our API route instead of ElevenLabs directly
      const response = await fetch('/api/voice-clone', {
        method: 'POST',
        body: formData
      })

      console.log('API response:', {
        status: response.status,
        ok: response.ok
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('API error response:', errorData)
        throw new Error(errorData.detail?.message || 'Failed to create voice clone')
      }

      const data = await response.json()
      console.log('API success response:', data)
      const voiceId = data.voice_id

      console.log('Updating Supabase with voice ID:', {
        userId,
        voiceId
      })

      // Save voice ID to user profile
      const supabase = getSupabase()
      const { error } = await supabase
        .from('users')
        .update({ eleven_labs_clone_id: voiceId })
        .eq('id', userId)

      if (error) {
        console.error('Supabase update error:', error)
        throw error
      }

      console.log('Voice clone process completed successfully')
      toast({
        title: "Success",
        description: "Voice clone created successfully!"
      })

      onVoiceCreated(voiceId)
    } catch (error) {
      console.error('Error in createVoiceClone:', error)
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
            Progress: {recordings.length} of {texts.length} recordings completed
          </p>
        </div>

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
              submitButtonText="Save Recording"
            />
          </div>
        ) : (
          <div>
            <p className="mb-4">All recordings complete! Ready to create your voice clone.</p>
            <Button 
              onClick={createVoiceClone} 
              disabled={isSubmitting || recordings.length !== texts.length}
              className="w-full"
            >
              {isSubmitting ? "Creating Voice Clone..." : "Create Voice Clone"}
            </Button>
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
          <pre>
            {JSON.stringify({
              currentStep,
              recordingsCount: recordings.length,
              requiredRecordings: texts.length,
              isSubmitting,
              showingSubmitButton: currentStep >= texts.length
            }, null, 2)}
          </pre>
        </div>
      </div>
    </Card>
  )
} 