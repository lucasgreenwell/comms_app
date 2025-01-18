'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void
  onCancel: () => void
  className?: string
  disabled?: boolean
}

export default function VoiceRecorder({ onRecordingComplete, onCancel, className, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const { toast } = useToast()

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [isRecording])

  const startRecording = async () => {
    try {
      setIsProcessing(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000
        const blob = new Blob(chunksRef.current, { type: 'audio/mp3' })
        onRecordingComplete(blob, duration)
        stream.getTracks().forEach(track => track.stop())
        setIsProcessing(false)
        setIsRecording(false)
      }

      startTimeRef.current = Date.now()
      mediaRecorder.start()
      setIsRecording(true)
      setIsProcessing(false)
    } catch (error) {
      console.error('Error starting recording:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not access microphone. Please check your browser permissions."
      })
      onCancel()
      setIsProcessing(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  return (
    <Button
      type="button"
      size="icon"
      variant={isRecording ? "destructive" : "secondary"}
      className={className}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isProcessing}
    >
      {isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  )
} 