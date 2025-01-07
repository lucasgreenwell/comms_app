import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCurrentUser, getSupabase } from '../auth'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { X } from 'lucide-react'
import ConversationThreadCommentItem from './ConversationThreadCommentItem'

interface ThreadComment {
  id: string
  user_id: string
  message_id: string
  conversation_id: string
  content: string
  created_at: string
  user: {
    id: string
    email: string
  }
}

interface ConversationThreadCommentsProps {
  messageId: string
  conversationId: string
  onClose: () => void
  originalMessage: {
    content: string
    sender: {
      email: string
    }
  }
}

export default function ConversationThreadComments({ messageId, conversationId, onClose, originalMessage }: ConversationThreadCommentsProps) {
  const [comments, setComments] = useState<ThreadComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchComments()
    setupRealtimeSubscription()
  }, [messageId])

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/conversation-thread-comments?messageId=${messageId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch comments')
      }
      const data = await response.json()
      setComments(data)
    } catch (error) {
      console.error('Error fetching comments:', error)
      setError('Failed to fetch comments')
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const supabase = getSupabase()
    const channel = supabase
      .channel(`public:conversation_thread_comments:message_id=eq.${messageId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_thread_comments', filter: `message_id=eq.${messageId}` }, (payload: RealtimePostgresChangesPayload<ThreadComment>) => {
        if (payload.eventType === 'INSERT') {
          fetchComments()
        } else if (payload.eventType === 'UPDATE') {
          setComments(prevComments => 
            prevComments.map(comment => 
              comment.id === payload.new.id ? { ...comment, ...payload.new } : comment
            )
          )
        } else if (payload.eventType === 'DELETE') {
          setComments(prevComments => 
            prevComments.filter(comment => comment.id !== payload.old?.id)
          )
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('User not authenticated')

      const response = await fetch('/api/conversation-thread-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          conversationId,
          userId: user.id,
          content: newComment.trim()
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send comment')
      }

      setNewComment('')
    } catch (error) {
      console.error('Error sending comment:', error)
      setError('Failed to send comment')
    }
  }

  if (loading) return <div className="w-[400px] border-l p-4">Loading comments...</div>
  if (error) return <div className="w-[400px] border-l p-4 text-red-500">{error}</div>

  return (
    <div className="w-[400px] border-l flex flex-col h-full">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-bold">Thread</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 border-b bg-gray-50">
        <div className="font-bold">{originalMessage.sender.email}</div>
        <div>{originalMessage.content}</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.map((comment) => (
          <ConversationThreadCommentItem
            key={comment.id}
            comment={comment}
            onCommentUpdate={fetchComments}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <Input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Reply to thread..."
          className="w-full mb-2"
        />
        <Button type="submit" className="w-full">Reply</Button>
      </form>
    </div>
  )
} 