'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, X } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void
  onCancel: () => void
  submitButtonText?: string
}

export default function VoiceRecorder({ onRecordingComplete, onCancel, submitButtonText = "Send Voice Message" }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { toast } = useToast()
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    console.log('VoiceRecorder State:', {
      isRecording,
      hasAudioBlob: !!audioBlob,
      hasAudioUrl: !!audioUrl,
      submitButtonText
    })
  }, [isRecording, audioBlob, audioUrl, submitButtonText])

  useEffect(() => {
    // Cleanup function to stop recording if component unmounts while recording
    return () => {
      console.log('VoiceRecorder cleanup:', {
        wasRecording: isRecording,
        hadAudioUrl: !!audioUrl
      })
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [isRecording, audioUrl])

  const startRecording = async () => {
    console.log('Starting recording...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      startTimeRef.current = Date.now()

      console.log('MediaRecorder initialized:', {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state
      })

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', {
          dataSize: event.data.size,
          dataType: event.data.type
        })
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, creating blob...')
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' })
        console.log('Blob created:', {
          size: audioBlob.size,
          type: audioBlob.type
        })
        setAudioBlob(audioBlob)
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      console.log('Recording started')
    } catch (error) {
      console.error('Error in startRecording:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not access microphone. Please check your browser permissions."
      })
    }
  }

  const stopRecording = () => {
    console.log('Stopping recording...')
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      console.log('Recording stopped')
    }
  }

  const handleSend = () => {
    console.log('Handling send:', {
      hasAudioBlob: !!audioBlob,
      hasStartTime: !!startTimeRef.current
    })
    if (audioBlob && startTimeRef.current) {
      const duration = (Date.now() - startTimeRef.current) / 1000
      console.log('Sending recording:', {
        duration,
        blobSize: audioBlob.size
      })
      onRecordingComplete(audioBlob, duration)
      // Clean up
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      setAudioBlob(null)
      setAudioUrl(null)
      console.log('Recording sent and cleaned up')
    }
  }

  const handleCancel = () => {
    console.log('Cancelling recording')
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    onCancel()
    console.log('Recording cancelled and cleaned up')
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-muted rounded-md">
      <div className="flex items-center gap-2">
        {!isRecording && !audioUrl && (
          <Button
            onClick={startRecording}
            variant="outline"
            size="icon"
            className="w-10 h-10"
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
        {isRecording && (
          <Button
            onClick={stopRecording}
            variant="destructive"
            size="icon"
            className="w-10 h-10"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}
        {audioUrl && (
          <audio controls src={audioUrl} className="max-w-[200px]" />
        )}
        <Button
          onClick={handleCancel}
          variant="ghost"
          size="icon"
          className="w-8 h-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {audioUrl && (
        <Button onClick={handleSend} className="w-full">
          {submitButtonText}
        </Button>
      )}

      {/* Debug Info */}
      <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
        <pre>
          {JSON.stringify({
            isRecording,
            hasAudioBlob: !!audioBlob,
            hasAudioUrl: !!audioUrl,
            submitButtonText,
            recordingStartTime: startTimeRef.current
          }, null, 2)}
        </pre>
      </div>
    </div>
  )
} 