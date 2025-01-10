'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '../../auth'
import { useUser } from '../../hooks/useUser'
import { usePresence } from '../../hooks/usePresence'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import MessageItem from '../MessageItem'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import ConversationThreadComments from '../ConversationThreadComments'
import { Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from "@/components/ui/use-toast"
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import UserDisplay from '../../components/UserDisplay'

interface Translation {
  id: string
  message_id: string | null
  conversation_thread_comment_id: string | null
  mandarin_chinese_translation: string | null
  spanish_translation: string | null
  english_translation: string | null
  hindi_translation: string | null
  arabic_translation: string | null
  bengali_translation: string | null
  portuguese_translation: string | null
  russian_translation: string | null
  japanese_translation: string | null
  western_punjabi_translation: string | null
}

interface Message {
  id: string
  content: string
  created_at: string
  sender: {
    id: string
    email: string
    display_name?: string | null
  }
  files?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    path: string
  }[]
  translation: Translation | null
}

interface FileUpload {
  id: string
  file_name: string
  file_type: string
  file_size: number
  path: string
  uploaded_by: string
}

interface Conversation {
  id: string
  type: 'dm' | 'group'
  name: string | null
}

interface Participant {
  id: string
  email: string
  display_name?: string | null
}

interface User {
  id: string
  email: string
  display_name?: string | null
  native_language?: string | null
}

export default function DirectMessagePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newMessage, setNewMessage] = useState('')
  const { onlineUsers } = usePresence()
  const { user } = useUser()
  const [activeThread, setActiveThread] = useState<{
    messageId: string;
    content: string;
    sender: {
      id: string;
      email: string;
      display_name?: string | null;
    };
  } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMessages()
    fetchConversationAndParticipants()
    updateLastReadTimestamp()

    // Set up real-time subscription
    const supabase = getSupabase()
    const channel = supabase.channel(`messages:${params.id}`)

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${params.id}`
        },
        (payload) => {
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${params.id}`
        },
        (payload) => {
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${params.id}`
        },
        (payload: RealtimePostgresChangesPayload<{
          id: string;
          conversation_id: string;
        }>) => {
          if (payload.eventType === 'DELETE') {
            setMessages((prevMessages) => {
              return prevMessages.filter((msg) => msg.id !== payload.old.id);
            });
          }
        }
      )

    channel.subscribe()

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe()
    }
  }, [params.id])

  // Add effect to handle thread ID from URL
  useEffect(() => {
    const threadId = searchParams.get('thread')
    if (threadId && messages.length > 0) {
      const message = messages.find(m => m.id === threadId)
      if (message) {
        setActiveThread({
          messageId: message.id,
          content: message.content,
          sender: message.sender
        })
      }
    }
  }, [searchParams, messages])

  // File subscriptions
  useEffect(() => {
    if (messages.length === 0) return;

    const messageIds = messages.map(m => m.id);
    const fileIds = messages.flatMap(m => m.files || []).map(f => f.id);

    if (messageIds.length === 0 && fileIds.length === 0) return;

    const supabase = getSupabase();
    const channel = supabase.channel(`files:${params.id}`);

    // Only set up file_attachments subscription if we have messages
    if (messageIds.length > 0) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'file_attachments',
          filter: `message_id=in.(${messageIds.join(',')})`
        },
        (payload) => {
          fetchMessages();
        }
      );
    }

    // Only set up files subscription if we have files
    if (fileIds.length > 0) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: `id=in.(${fileIds.join(',')})`
        },
        (payload) => {
          fetchMessages();
        }
      );
    }

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [params.id, messages]);

  const fetchConversationAndParticipants = async () => {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Fetch conversation details
    const { data: conversationData, error: convError } = await supabase
      .from('conversations')
      .select('id, type, name')
      .eq('id', params.id)
      .single()

    if (convError) {
      console.error('Error fetching conversation:', convError)
      return
    }

    setConversation(conversationData)

    // Fetch all participants except current user
    const { data: participantsData, error: partError } = await supabase
      .from('conversation_participants')
      .select('user:users!conversation_participants_user_id_fkey (id, email, display_name)')
      .eq('conversation_id', params.id)
      .neq('user_id', user.id)

    if (partError) {
      console.error('Error fetching participants:', partError)
      return
    }

    // Transform the data to handle the array structure from Supabase
    const transformedParticipants = participantsData.map(p => 
      Array.isArray(p.user) ? p.user[0] : p.user
    )

    setParticipants(transformedParticipants)
  }

  const fetchMessages = async () => {
    const supabase = getSupabase()
    
    type DbMessage = {
      id: string;
      content: string;
      created_at: string;
      sender: {
        id: string;
        email: string;
      } | {
        id: string;
        email: string;
      }[];
      files: {
        id: string;
        file: {
          id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          path: string;
        };
      }[] | null;
      translations: {
        id: string;
        message_id: string | null;
        conversation_thread_comment_id: string | null;
        mandarin_chinese_translation: string | null;
        spanish_translation: string | null;
        english_translation: string | null;
        hindi_translation: string | null;
        arabic_translation: string | null;
        bengali_translation: string | null;
        portuguese_translation: string | null;
        russian_translation: string | null;
        japanese_translation: string | null;
        western_punjabi_translation: string | null;
      }[] | null;
    }

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        sender:sender_id(
          id,
          email,
          display_name,
          native_language
        ),
        files:file_attachments(
          id,
          file:file_id(
            id,
            file_name,
            file_type,
            file_size,
            path
          )
        ),
        translations(
          id,
          message_id,
          conversation_thread_comment_id,
          mandarin_chinese_translation,
          spanish_translation,
          english_translation,
          hindi_translation,
          arabic_translation,
          bengali_translation,
          portuguese_translation,
          russian_translation,
          japanese_translation,
          western_punjabi_translation
        )
      `)
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return
    }

    // Transform the data to handle the array structure from Supabase
    const transformedMessages = (data as unknown as DbMessage[])?.map(msg => ({
      id: msg.id,
      content: msg.content,
      created_at: msg.created_at,
      sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
      files: msg.files?.map(f => ({
        id: f.file.id,
        file_name: f.file.file_name,
        file_type: f.file.file_type,
        file_size: f.file.file_size,
        path: f.file.path
      })),
      translation: msg.translations?.[0] || null
    })) || []

    setMessages(transformedMessages)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && selectedFiles.length === 0) return

    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // First, upload any files
      const filePromises = selectedFiles.map(async (file: File) => {
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

        return fileData as FileUpload
      })

      const uploadedFiles = await Promise.all(filePromises)

      // Create message
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim(),
          conversation_id: params.id,
          sender_id: user.id
        })
        .select()
        .single()

      if (messageError) throw messageError

      // Create file attachments
      if (uploadedFiles.length > 0) {
        const { error: attachmentError } = await supabase
          .from('file_attachments')
          .insert(
            uploadedFiles.map(file => ({
              file_id: file.id,
              message_id: messageData.id
            }))
          )

        if (attachmentError) throw attachmentError
      }

      // Clear input and show success immediately
      setNewMessage('')
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      toast({
        title: "Message sent",
        description: "Your message has been sent successfully."
      })

      // Trigger translation in the background
      const triggerTranslation = async () => {
        try {
          await fetch('/api/translations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messageId: messageData.id,
              senderId: user.id
            }),
          })
        } catch (translationError) {
          console.error('Translation error:', translationError)
        }
      }

      // Don't await the translation
      triggerTranslation()

    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: "There was an error sending your message. Please try again."
      })
    }
  }

  // Modify the onThreadOpen handler to update URL
  const handleThreadOpen = (message: {
    id: string;
    content: string;
    sender: {
      id: string;
      email: string;
      display_name?: string | null;
    };
  }) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('thread', message.id)
    router.push(`/dm/${params.id}?${newSearchParams.toString()}`)
    setActiveThread({
      messageId: message.id,
      content: message.content,
      sender: message.sender
    })
  }

  // Modify the thread close handler to remove thread from URL
  const handleThreadClose = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('thread')
    router.push(`/dm/${params.id}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`)
    setActiveThread(null)
  }

  const updateLastReadTimestamp = async () => {
    try {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // First check if the participant record exists
      const { data: participant, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, last_read_at')
        .eq('conversation_id', params.id)
        .eq('user_id', user.id)
        .single()

      // Now update the last_read_at timestamp
      const { data, error } = await supabase
        .from('conversation_participants')
        .update({ 
          last_read_at: new Date().toISOString() 
        })
        .eq('conversation_id', params.id)
        .eq('user_id', user.id)
        .select('conversation_id, user_id, last_read_at')

    } catch (error) {
      console.error('Error in updateLastReadTimestamp:', error)
    }
  }

  // Add effect to update last_read_at when messages change
  useEffect(() => {
    if (messages.length > 0) {
      updateLastReadTimestamp()
    }
  }, [messages])

  return (
    <div className="flex h-full">
      <div className={`flex-1 flex flex-col h-full ${activeThread ? 'max-w-[calc(100%-400px)]' : ''}`}>
        <h1 className="text-2xl font-bold mb-4 p-4">
          {conversation?.type === 'dm' ? (
            <div className="flex items-center">
              Chat with{' '}
              {participants[0] && (
                <UserDisplay 
                  user={participants[0]}
                  isOnline={onlineUsers.has(participants[0].id)}
                  className="ml-2"
                />
              )}
            </div>
          ) : (
            <div>
              <div>{conversation?.name || 'Group Chat'}</div>
              <div className="text-sm font-normal text-gray-500 flex flex-wrap gap-2">
                {participants.map((p, i) => (
                  <span key={p.id}>
                    <UserDisplay 
                      user={p}
                      isOnline={onlineUsers.has(p.id)}
                    />
                    {i < participants.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </h1>
        <div className="flex-1 overflow-y-auto">
          <div>
            {messages.map((message) => (
              <MessageItem 
                key={message.id} 
                message={message} 
                currentUser={user} 
                onlineUsers={onlineUsers}
                onThreadOpen={handleThreadOpen}
              />
            ))}
          </div>
        </div>
        <form onSubmit={sendMessage} className="p-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="Type your message..."
            />
            <Button 
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button type="submit">
              Send
            </Button>
          </div>
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
                  <span className="text-sm">{file.name}</span>
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
      {activeThread && (
        <ConversationThreadComments 
          messageId={activeThread.messageId}
          conversationId={params.id}
          originalMessage={{
            id: activeThread.messageId,
            content: activeThread.content,
            sender: activeThread.sender
          }}
          onClose={handleThreadClose}
        />
      )}
    </div>
  )
} 