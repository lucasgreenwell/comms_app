'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { getSupabase, getCurrentUser } from '../../auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

export default function Channel() {
  const { channelId } = useParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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

  if (loading) return <div>Loading posts...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="flex flex-col h-full p-4">
      <h1 className="text-2xl font-bold mb-4">Channel: {channelId}</h1>
      <div className="flex-1 overflow-y-auto mb-4">
        {posts.map((post) => (
          <div key={post.id} className="mb-2">
            <strong>{post.user.email}:</strong> {post.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <Input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  )
}

