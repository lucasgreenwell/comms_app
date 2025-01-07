import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit2, Trash2, X, Check } from 'lucide-react'
import { getCurrentUser, getSupabase } from '../../auth'

interface ThreadComment {
  id: string
  user_id: string
  post_id: string
  content: string
  created_at: string
  user: {
    id: string
    email: string
  }
}

interface ThreadCommentItemProps {
  comment: ThreadComment
  onCommentUpdate: () => void
}

export default function ThreadCommentItem({ comment, onCommentUpdate }: ThreadCommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(comment.content)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user))
  }, [])

  const isOwner = currentUser?.id === comment.user_id

  const handleEdit = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('post_thread_comments')
        .update({ content: editedContent })
        .eq('id', comment.id)

      if (error) throw error
      
      setIsEditing(false)
      onCommentUpdate()
    } catch (error) {
      console.error('Error updating comment:', error)
    }
  }

  const handleDelete = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('post_thread_comments')
        .delete()
        .eq('id', comment.id)

      if (error) throw error
      
      onCommentUpdate()
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedContent(comment.content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEdit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="bg-gray-50 p-3 rounded">
        <div className="font-bold">{comment.user.email}</div>
        <div className="mt-2 flex gap-2">
          <Input
            type="text"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleEdit}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Press Enter to save, Escape to cancel
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 p-3 rounded group">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="font-bold">{comment.user.email}</div>
          <div>{comment.content}</div>
        </div>
        {isOwner && (
          <div className="hidden group-hover:flex gap-1">
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