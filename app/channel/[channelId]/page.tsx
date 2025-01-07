'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase, getCurrentUser } from '../../auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import PostItem from './PostItem'

interface Post {
  id: string
  user_id: string
  channel_id: string
  content: string
  created_at: string
  user: {
    id: string
    email: string
  }
}

interface Channel {
  id: string
  name: string
}

export default function Channel() {
  const { channelId } = useParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [channel, setChannel] = useState<Channel | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchChannel()
    fetchPosts()
    setupRealtimeSubscription()
  }, [channelId])

  useEffect(() => {
    scrollToBottom()
  }, [posts])

  const fetchPosts = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/posts?channelId=${channelId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch posts')
      }
      const data = await response.json()
      setPosts(data)
    } catch (error) {
      setError('Failed to fetch posts')
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const supabase = getSupabase()
    const channel = supabase
      .channel(`public:posts:channel_id=eq.${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `channel_id=eq.${channelId}` }, (payload) => {
        console.log('Change received!', payload)
        if (payload.eventType === 'INSERT') {
          fetchPosts() // Refetch all posts to ensure we have the latest data with user info
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('User not authenticated')

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId,
          userId: user.id,
          content: newMessage.trim()
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchChannel = async () => {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('channels')
        .select('id, name')
        .eq('id', channelId)
        .single()

      if (error) throw error
      setChannel(data)
    } catch (error) {
      console.error('Error fetching channel:', error)
      setError('Failed to fetch channel details')
    }
  }

  const handleLeaveChannel = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('User not authenticated')

      const supabase = getSupabase()
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', user.id)

      if (error) throw error
      router.push('/') // Redirect to home page after leaving
    } catch (error) {
      console.error('Error leaving channel:', error)
      setError('Failed to leave channel')
    }
  }

  if (loading) return <div>Loading posts...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="flex flex-col h-full p-4 max-w-[1200px] mx-auto w-full">
      <div className="flex justify-between items-center mb-4 w-full min-w-0">
        <h1 className="text-2xl font-bold truncate">
          # {channel?.name || 'Loading...'}
        </h1>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleLeaveChannel}
          className="text-red-500 hover:text-red-700 hover:bg-red-100 shrink-0 ml-4"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Leave Channel
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto mb-4 w-full min-w-0">
        <div className="flex flex-col w-full min-w-0">
          {posts.map((post) => (
            <PostItem key={post.id} post={post} onPostUpdate={fetchPosts} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form onSubmit={handleSendMessage} className="flex gap-4 w-full min-w-0">
        <div className="flex-1 min-w-0">
          <Input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="w-full"
          />
        </div>
        <Button type="submit" className="shrink-0">Send</Button>
      </form>
    </div>
  )
}

