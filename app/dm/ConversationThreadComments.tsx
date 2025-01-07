import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCurrentUser, getSupabase } from '../auth'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { X, Paperclip } from 'lucide-react'
import ConversationThreadCommentItem from '../dm/ConversationThreadCommentItem'
import { useToast } from '@/components/ui/use-toast'
import { themes } from '../config/themes'

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
  files?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    path: string
  }[]
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return themes.find(t => t.id === localStorage.getItem('slack-clone-theme')) || themes[0]
    }
    return themes[0]
  })

  useEffect(() => {
    const handleStorageChange = () => {
      const themeId = localStorage.getItem('slack-clone-theme')
      setTheme(themes.find(t => t.id === themeId) || themes[0])
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

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

    // Get all comment IDs and file IDs for filters
    const commentIds = comments.map(c => c.id)
    const fileIds = comments.flatMap(c => c.files || []).map(f => f.id)

    const channel = supabase
      .channel(`thread-comments:${messageId}`)
      // Listen for thread comment changes
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'conversation_thread_comments', 
          filter: `message_id=eq.${messageId}` 
        }, 
        (payload: RealtimePostgresChangesPayload<ThreadComment>) => {
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
        }
      )

    // Only add file-related subscriptions if we have comments
    if (commentIds.length > 0) {
      // Listen for file attachment changes
      channel.on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'file_attachments',
          filter: `conversation_thread_comment_id=in.(${commentIds.join(',')})`
        },
        () => {
          fetchComments()
        }
      )
    }

    // Only add file subscriptions if we have files
    if (fileIds.length > 0) {
      // Listen for file changes
      channel.on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: `id=in.(${fileIds.join(',')})`
        },
        () => {
          fetchComments()
        }
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() && selectedFiles.length === 0) return

    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('User not authenticated')

      // First, upload any files
      const filePromises = selectedFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        // Upload file to storage
        const { error: uploadError } = await getSupabase().storage
          .from('file-uploads')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Create file record
        const { data: fileData, error: fileRecordError } = await getSupabase()
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

        return fileData
      })

      const uploadedFiles = await Promise.all(filePromises)

      // Create comment
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

      const commentData = await response.json()

      // Create file attachments
      if (uploadedFiles.length > 0) {
        const { error: attachmentError } = await getSupabase()
          .from('file_attachments')
          .insert(
            uploadedFiles.map(file => ({
              file_id: file.id,
              conversation_thread_comment_id: commentData.id,
              message_id: null
            }))
          )

        if (attachmentError) throw attachmentError
      }

      setNewComment('')
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      toast({
        title: "Comment sent",
        description: "Your comment has been sent successfully."
      })
    } catch (error) {
      console.error('Error sending comment:', error)
      setError('Failed to send comment')
      toast({
        variant: "destructive",
        title: "Error sending comment",
        description: "There was an error sending your comment. Please try again."
      })
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

      <div className={`${theme.colors.background} p-4 border-b ${theme.colors.foreground}`}>
        <div className={`font-bold ${theme.colors.foreground}`}>{originalMessage.sender.email}</div>
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

      <form onSubmit={handleSubmit} className="p-4 border-t space-y-2">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Reply to thread..."
            className="flex-1"
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
            Reply
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
  )
} 