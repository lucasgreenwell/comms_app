import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Edit2, Trash2, X, Check, MessageSquare } from 'lucide-react'
import { getCurrentUser, getSupabase } from '../../auth'

interface Post {
  id: string
  user_id: string
  content: string
  user: {
    id: string
    email: string
  }
}

interface PostItemProps {
  post: Post
  onPostUpdate: () => void
  onThreadOpen: (post: Post) => void
}

export default function PostItem({ post, onPostUpdate, onThreadOpen }: PostItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(post.content)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [threadCount, setThreadCount] = useState(0)

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user))
    fetchThreadCount()
  }, [])

  const isOwner = currentUser?.id === post.user_id

  const fetchThreadCount = async () => {
    try {
      const supabase = getSupabase()
      const { count, error } = await supabase
        .from('post_thread_comments')
        .select('id', { count: 'exact' })
        .eq('post_id', post.id)

      if (error) throw error
      setThreadCount(count || 0)
    } catch (error) {
      console.error('Error fetching thread count:', error)
    }
  }

  const handleEdit = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('posts')
        .update({ content: editedContent })
        .eq('id', post.id)

      if (error) throw error
      
      setIsEditing(false)
      onPostUpdate()
    } catch (error) {
      console.error('Error updating post:', error)
    }
  }

  const handleDelete = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)

      if (error) throw error
      
      onPostUpdate()
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 mb-2 p-2 bg-gray-50 rounded">
        <div className="flex items-center">
          <strong>{post.user.email}:</strong>
        </div>
        <div className="flex gap-2">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="flex-1 min-h-[100px] p-2 border rounded resize-y"
            autoFocus
          />
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleEdit}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start mb-2 group">
      <div className="flex-1">
        <strong>{post.user.email}:</strong> {post.content}
      </div>
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => onThreadOpen(post)}
          className="hidden group-hover:flex items-center gap-1"
        >
          <MessageSquare className="h-4 w-4" />
          {threadCount > 0 && <span className="text-xs">{threadCount}</span>}
        </Button>
        {isOwner && (
          <div className="hidden group-hover:flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 