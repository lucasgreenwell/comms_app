import { useState, useEffect } from 'react'
import { getCurrentUser, getSupabase } from '../../auth'
import MessageDisplay from '../../components/MessageDisplay'
import { usePresence } from '../../hooks/usePresence'

interface Post {
  id: string
  user_id: string
  channel_id: string
  content: string
  created_at: string
  user: {
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
}

interface PostItemProps {
  post: Post
  onPostUpdate: (updatedPost: Post) => void
  onThreadOpen: (post: Post) => void
}

export default function PostItem({ post, onPostUpdate, onThreadOpen }: PostItemProps) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [threadCount, setThreadCount] = useState(0)
  const { onlineUsers } = usePresence()

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user))
    fetchThreadCount()
  }, [])

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

  const handleUpdate = (updatedContent: string) => {
    const updatedPost = { ...post, content: updatedContent };
    onPostUpdate(updatedPost);
  };

  return (
    <MessageDisplay
      id={post.id}
      content={post.content}
      user={post.user}
      files={post.files}
      currentUser={currentUser}
      onlineUsers={onlineUsers}
      messageType="post"
      threadCount={threadCount}
      onThreadOpen={() => onThreadOpen(post)}
      onUpdate={handleUpdate}
      tableName="posts"
      className="mb-4"
      created_at={post.created_at}
    />
  )
} 