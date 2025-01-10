'use client'

import { useState, useEffect, useRef } from 'react'
import { getCurrentUser, getSupabase } from '../../auth'
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
  const [user, setUser] = useState<User | null>(null)
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

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = getSupabase()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        // Fetch additional user data
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, display_name, native_language')
          .eq('id', authUser.id)
          .single()
        
        setUser(userData)
      }
    }
    fetchUser()
  }, [])

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
          display_name
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
      const user = await getCurrentUser()
      if (!user) throw new Error('User not authenticated')
      const supabase = getSupabase()

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
    <div
      className={`relative p-4 rounded-lg shadow-sm transition-transform transform hover:scale-[1.02] bg-white group ${messageAlignment} ${maxWidth} ${className}`}
    >
      <div className="flex justify-between items-start">
        {/* User and Message Content */}
        <div className="flex-1 min-w-0">
          <UserDisplay
            user={user}
            isOnline={onlineUsers.has(user.id)}
            className="text-sm font-semibold text-gray-800"
          />
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{content}</div>
              </TooltipTrigger>
              {getTranslatedContent() && (
                <TooltipContent
                  side="top"
                  align="start"
                  className="z-50 bg-white shadow-lg border rounded-md p-3"
                  style={{
                    maxWidth: '300px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <p className="text-sm text-gray-600">{getTranslatedContent()}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {/* Files */}
          {files && files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center p-2 bg-gray-50 rounded-md border hover:bg-gray-100 transition-colors"
                >
                  <FileIcon className="h-5 w-5 text-gray-500" />
                  <div className="flex-1 ml-3 min-w-0">
                    <div className="text-sm font-medium truncate">{file.file_name}</div>
                    <div className="text-xs text-gray-500">{formatFileSize(file.file_size)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-blue-600"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600"
                        onClick={() => handleFileDelete(file)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Reactions */}
          <div className="mt-3 flex gap-2 flex-wrap">
            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
              <Button
                key={emoji}
                size="sm"
                variant="outline"
                className="px-3 py-1 text-sm rounded-full border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  const userReaction = reactions.find(r => r.user_id === currentUser?.id);
                  if (userReaction) {
                    handleRemoveReaction(userReaction.id);
                  } else {
                    handleAddReaction(emoji);
                  }
                }}
              >
                <span>{emoji}</span>
                <span className="ml-1 text-gray-500">{reactions.length}</span>
              </Button>
            ))}
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center gap-2">
            {currentUser && !hideActions && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 bg-white shadow-lg rounded-md">
                  <div className="grid grid-cols-8 gap-2">
                    {EMOJI_PAGES[currentPage].map((emoji) => (
                      <Button
                        key={emoji}
                        size="sm"
                        variant="ghost"
                        className="p-2 hover:bg-gray-100 rounded-md"
                        onClick={() => handleAddReaction(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCurrentPage((prev) => (prev > 0 ? prev - 1 : EMOJI_PAGES.length - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-gray-500">
                      Page {currentPage + 1} of {EMOJI_PAGES.length}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCurrentPage((prev) => (prev < EMOJI_PAGES.length - 1 ? prev + 1 : 0))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {isOwner && !hideActions && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="h-5 w-5 text-gray-700" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
          <span className="text-xs text-gray-500">{formatTimestamp(created_at)}</span>
        </div>
      </div>
    </div>
  );
  
} 