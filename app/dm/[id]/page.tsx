'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '../../auth'
import { usePresence } from '../../hooks/usePresence'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import MessageItem from '../../components/MessageItem'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Message {
  id: string
  content: string
  created_at: string
  sender: {
    id: string
    email: string
  }
}

interface Conversation {
  id: string
  type: 'dm' | 'group'
  name: string | null
}

interface Participant {
  id: string
  email: string
}

export default function DirectMessagePage({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newMessage, setNewMessage] = useState('')
  const { onlineUsers } = usePresence()
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    fetchMessages()
    fetchConversationAndParticipants()

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

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser({ id: user.id })
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
      .select('user:users!conversation_participants_user_id_fkey (id, email)')
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
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        sender:sender_id(
          id,
          email
        )
      `)
      .eq('conversation_id', params.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return
    }

    // Transform the data to handle the array structure from Supabase
    const transformedMessages = data?.map(msg => ({
      ...msg,
      sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
    })) || []

    setMessages(transformedMessages as Message[])
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    const { error } = await supabase
      .from('messages')
      .insert({
        content: newMessage,
        conversation_id: params.id,
        sender_id: user.id
      })

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    setNewMessage('')
    fetchMessages()
  }

  return (
    <div className="flex-1 p-4">
      <h1 className="text-2xl font-bold mb-4">
        {conversation?.type === 'dm' ? (
          <div className="flex items-center">
            Chat with {participants[0]?.email}
            {participants[0] && onlineUsers.has(participants[0].id) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="ml-2 text-green-500">●</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Online</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <div>
            <div>{conversation?.name || 'Group Chat'}</div>
            <div className="text-sm font-normal text-gray-500">
              {participants.map((p, i) => (
                <span key={p.id}>
                  {p.email}
                  {onlineUsers.has(p.id) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="ml-1 text-green-500">●</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Online</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {i < participants.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </h1>
      <div className="space-y-4 mb-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {messages.map((message) => (
          <MessageItem 
            key={message.id} 
            message={message} 
            currentUser={user} 
            onlineUsers={onlineUsers} 
          />
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 p-2 border rounded"
          placeholder="Type your message..."
        />
        <button 
          type="submit" 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  )
} 