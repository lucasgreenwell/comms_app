import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Paperclip } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { getSupabase } from '../auth'
import VoiceRecorder from './VoiceRecorder'
import VoiceMessage from './VoiceMessage'
import type { FileAttachment } from '../types/entities/FileAttachment'

interface MessageInputProps {
  messageType: 'channel' | 'dm' | 'channel_thread' | 'dm_thread'
  parentId: string
  secondaryId?: string
  placeholder?: string
  className?: string
  participants?: { id: string }[]
}

export default function MessageInput({ 
  messageType, 
  parentId,
  secondaryId,
  placeholder = "Type your message...",
  className = "",
  participants = []
}: MessageInputProps) {
  const [newMessage, setNewMessage] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isBotTyping, setIsBotTyping] = useState(false)
  const [voicePreview, setVoicePreview] = useState<{
    blob: Blob,
    url: string,
    duration: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Cleanup function for voice preview
  const cleanupVoicePreview = () => {
    if (voicePreview?.url) {
      URL.revokeObjectURL(voicePreview.url)
      setVoicePreview(null)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupVoicePreview()
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleVoiceRecordingComplete = async (audioBlob: Blob, duration: number) => {
    // Create preview URL and save blob for later upload
    const url = URL.createObjectURL(audioBlob)
    setVoicePreview({
      blob: audioBlob,
      url,
      duration
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && selectedFiles.length === 0 && !voicePreview) return

    // Store message content and files before clearing
    const messageContent = newMessage
    const filesToUpload = [...selectedFiles]

    // Clear input and files immediately
    setNewMessage('')
    setSelectedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    // Cleanup voice preview immediately after submission begins
    cleanupVoicePreview()

    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Handle voice message upload if exists
      if (voicePreview) {
        const fileName = `${Math.random().toString(36).substring(2)}.mp3`
        const filePath = `${user.id}/${fileName}`

        // Upload voice message
        const { error: uploadError } = await supabase.storage
          .from('voice-messages')
          .upload(filePath, voicePreview.blob)

        if (uploadError) throw uploadError

        // Create file record
        const { data: fileData, error: fileRecordError } = await supabase
          .from('files')
          .insert({
            file_name: fileName,
            file_type: 'audio/mp3',
            file_size: voicePreview.blob.size,
            bucket: 'voice-messages',
            path: filePath,
            uploaded_by: user.id,
            duration_seconds: voicePreview.duration
          })
          .select()
          .single()

        if (fileRecordError) throw fileRecordError

        // Create message with voice attachment
        const messageData = await createMessage(user.id, messageContent, [fileData])
        await triggerTranslation(messageData.id, user.id)
      } else {
        // Handle regular message with potential file attachments
        const messageData = await createMessage(user.id, messageContent, [])

        // Handle file uploads if any
        if (filesToUpload.length > 0) {
          await handleFileUploads(messageData.id)
        }

        await triggerTranslation(messageData.id, user.id)
      }

      // For DMs, trigger AI response in the background
      if (messageType === 'dm' && participants.length === 1) {
        const recipient = participants[0]
        fetch('/api/ai-response', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: messageContent,
            conversationId: parentId,
            senderId: user.id,
            recipientId: recipient.id
          }),
        }).catch(error => {
          console.error('Error triggering AI response:', error)
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: "There was an error sending your message. Please try again."
      })
      // Restore the message content and files if there was an error
      setNewMessage(messageContent)
      setSelectedFiles(filesToUpload)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''  // Clear and re-trigger change event
        const dataTransfer = new DataTransfer()
        filesToUpload.forEach(file => dataTransfer.items.add(file))
        fileInputRef.current.files = dataTransfer.files
      }
    }
  }

  const handleFileUploads = async (messageId: string) => {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Upload each file
    for (const file of selectedFiles) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('file-uploads')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Create file record
      const { data: fileData, error: fileRecordError } = await supabase
        .from('files')
        .insert({
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          bucket: 'file-uploads',
          path: filePath,
          uploaded_by: user.id
        })
        .select()
        .single()

      if (fileRecordError) throw fileRecordError

      // Create file attachment
      const { error: attachmentError } = await supabase
        .from('file_attachments')
        .insert({
          file_id: fileData.id,
          message_id: messageId
        })

      if (attachmentError) throw attachmentError
    }
  }

  const createMessage = async (userId: string, content: string, files: any[]) => {
    const supabase = getSupabase()
    let table: string
    let data: any = {
      content
    }

    // Set up the correct table and data based on message type
    switch (messageType) {
      case 'channel':
        table = 'posts'
        data.user_id = userId
        data.channel_id = parentId
        break
      case 'dm':
        table = 'messages'
        data.sender_id = userId
        data.conversation_id = parentId
        break
      case 'channel_thread':
        table = 'post_thread_comments'
        data.user_id = userId
        data.post_id = parentId
        break
      case 'dm_thread':
        table = 'conversation_thread_comments'
        data.user_id = userId
        data.message_id = parentId
        if (secondaryId) {
          data.conversation_id = secondaryId
        }
        break
      default:
        throw new Error('Invalid message type')
    }

    // Create the message/post/comment
    const { data: messageData, error: messageError } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single()

    if (messageError) throw messageError

    // Create file attachments if any
    if (files.length > 0) {
      const attachments = files.map(file => {
        const attachment: any = {
          file_id: file.id
        }
        
        // Set the correct foreign key based on message type
        switch (messageType) {
          case 'channel':
            attachment.post_id = messageData.id
            break
          case 'dm':
            attachment.message_id = messageData.id
            break
          case 'channel_thread':
            attachment.post_thread_comment_id = messageData.id
            break
          case 'dm_thread':
            attachment.conversation_thread_comment_id = messageData.id
            break
        }
        
        return attachment
      })

      const { error: attachmentError } = await supabase
        .from('file_attachments')
        .insert(attachments)

      if (attachmentError) throw attachmentError
    }

    return messageData
  }

  const triggerTranslation = async (messageId: string, senderId: string) => {
    try {
      const body: any = { senderId }

      // Set the correct ID field based on message type
      switch (messageType) {
        case 'channel':
          body.postId = messageId
          break
        case 'dm':
          body.messageId = messageId
          break
        case 'channel_thread':
          body.postThreadCommentId = messageId
          break
        case 'dm_thread':
          body.conversationThreadCommentId = messageId
          break
      }

      await fetch('/api/translations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (translationError) {
      console.error('Translation error:', translationError)
    }
  }

  return (
    <div className="space-y-2">
      {isBotTyping && (
        <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
          <span>Bot is typing</span>
          <span className="inline-flex">
            <span className="animate-bounce">.</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
          </span>
        </div>
      )}
      <form onSubmit={handleSubmit} className={`space-y-2 ${className}`}>
        <div className="flex gap-2">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            onCancel={cleanupVoicePreview}
            className="w-10 h-10"
          />
          <Button 
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="submit">Send</Button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
        <div className="flex flex-col gap-2">
          {voicePreview && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <VoiceMessage
                bucket="voice-messages"
                path=""
                duration={voicePreview.duration}
                previewUrl={voicePreview.url}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={cleanupVoicePreview}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  )
} 