import { useState, useEffect } from 'react'
import { getCurrentUser } from '../../auth'
import MessageDisplay from '../../components/MessageDisplay'
import { usePresence } from '../../hooks/usePresence'

interface ThreadComment {
  id: string
  user_id: string
  post_id: string
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

interface ThreadCommentItemProps {
  comment: ThreadComment
  onCommentUpdate: () => void
}

export default function ThreadCommentItem({ comment, onCommentUpdate }: ThreadCommentItemProps) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { onlineUsers } = usePresence()

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user))
  }, [])

  return (
    <MessageDisplay
      id={comment.id}
      content={comment.content}
      user={comment.user}
      files={comment.files}
      currentUser={currentUser}
      onlineUsers={onlineUsers}
      messageType="post_thread"
      onUpdate={onCommentUpdate}
      tableName="post_thread_comments"
      created_at={comment.created_at}
    />
  )
} 