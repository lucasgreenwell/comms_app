import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X, Paperclip, Mic } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { getSupabase } from '../auth'
import VoiceRecorder from './VoiceRecorder'
import type { FileAttachment } from '../types/entities/FileAttachment'

interface MessageInputProps {
  // The type of message being sent
  messageType: 'channel' | 'dm' | 'channel_thread' | 'dm_thread'
  // The ID of the parent container (channel, conversation, or message)
  parentId: string
  // Optional secondary ID (e.g., conversation_id for DM threads)
  secondaryId?: string
  // Optional placeholder text
  placeholder?: string
  // Optional class name for styling
  className?: string
  // Optional participants array for checking bot conversations
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
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [isBotTyping, setIsBotTyping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleVoiceRecordingComplete = async (audioBlob: Blob, duration: number) => {
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Generate unique filename for the audio file
      const fileName = `${Math.random().toString(36).substring(2)}.mp3`
      const filePath = `${user.id}/${fileName}`

      // Upload audio file to storage
      const { error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(filePath, audioBlob)

      if (uploadError) throw uploadError

      // Create file record with duration
      const { data: fileData, error: fileRecordError } = await supabase
        .from('files')
        .insert({
          file_name: fileName,
          file_type: 'audio/mp3',
          file_size: audioBlob.size,
          bucket: 'voice-messages',
          path: filePath,
          uploaded_by: user.id,
          duration_seconds: duration
        })
        .select()
        .single()

      if (fileRecordError) throw fileRecordError

      // Create message/post/comment based on type
      const messageData = await createMessage(user.id, '', [fileData])

      setShowVoiceRecorder(false)
      toast({
        title: "Voice message sent",
        description: "Your voice message has been sent successfully."
      })

      // Trigger translation
      await triggerTranslation(messageData.id, user.id)

    } catch (error) {
      console.error('Error sending voice message:', error)
      toast({
        variant: "destructive",
        title: "Error sending voice message",
        description: "There was an error sending your voice message. Please try again."
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && selectedFiles.length === 0) return

    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Always send the original message first
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          content: newMessage,
          conversation_id: parentId,
          sender_id: user.id
        })
        .select()
        .single()

      if (messageError) throw messageError

      // Handle file uploads if any
      if (selectedFiles.length > 0) {
        await handleFileUploads(message.id)
      }

      // Clear input and files
      setNewMessage('')
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
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
            content: newMessage,
            conversationId: parentId,
            senderId: user.id,
            recipientId: recipient.id
          }),
        }).catch(error => {
          console.error('Error triggering AI response:', error)
          // Don't show error to user since message was sent successfully
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: "There was an error sending your message. Please try again."
      })
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
          <Button 
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowVoiceRecorder(true)}
            className="w-10 h-10"
          >
            <Mic className="h-4 w-4" />
          </Button>
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
        {showVoiceRecorder && (
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
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
      </form>
    </div>
  )
} 