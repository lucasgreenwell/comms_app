import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Edit2, Trash2, X, Check } from 'lucide-react'
import { getCurrentUser, getSupabase } from '../../auth'

interface PostItemProps {
  post: {
    id: string
    user_id: string
    content: string
    user: {
      id: string
      email: string
    }
  }
  onPostUpdate: () => void
}

export default function PostItem({ post, onPostUpdate }: PostItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(post.content)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user))
  }, [])

  const isOwner = currentUser?.id === post.user_id

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
    if (!confirm('Are you sure you want to delete this message?')) return

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
    <div className="flex gap-2 items-center mb-2 group">
      <strong>{post.user.email}:</strong> {post.content}
      {isOwner && (
        <div className="hidden group-hover:flex gap-2 ml-2">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
} 