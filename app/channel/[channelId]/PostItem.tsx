import { useState, useEffect } from 'react'
import { getSupabase } from '../../auth'
import { useUser } from '../../hooks/useUser'
import { usePresence } from '../../hooks/usePresence'
import { Button } from '@/components/ui/button'
import MessageDisplay from '../../components/MessageDisplay'
import { MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { Post } from '@/app/types/post'
import type { PostItemProps } from '@/app/types/props/PostItemProps'

export default function PostItem({ post, onPostUpdate, onThreadOpen }: PostItemProps) {
  const [threadCount, setThreadCount] = useState(0)
  const { onlineUsers } = usePresence()
  const { user: currentUser } = useUser()
  const [currentPost, setCurrentPost] = useState(post)

  useEffect(() => {
    fetchThreadCount()
    const cleanup = setupTranslationSubscription()
    return () => {
      cleanup()
    }
  }, [])

  const setupTranslationSubscription = () => {
    const supabase = getSupabase()
    const channel = supabase.channel(`post-translations:${post.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'translations',
          filter: `post_id=eq.${post.id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch the updated post with the new translation
            const { data: updatedPost, error } = await supabase
              .from('posts')
              .select(`
                id,
                user_id,
                channel_id,
                content,
                created_at,
                translations (
                  id,
                  message_id,
                  conversation_thread_comment_id,
                  post_id,
                  post_thread_comment_id,
                  mandarin_chinese_translation,
                  spanish_translation,
                  english_translation,
                  hindi_translation,
                  arabic_translation,
                  bengali_translation,
                  portuguese_translation,
                  russian_translation,
                  japanese_translation,
                  western_punjabi_translation
                )
              `)
              .eq('id', post.id)
              .single()

            if (!error && updatedPost) {
              setCurrentPost({
                ...currentPost,
                translation: updatedPost.translations?.[0] || null
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

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
    const updatedPost = { ...currentPost, content: updatedContent };
    setCurrentPost(updatedPost);
    onPostUpdate(updatedPost);
  };

  return (
    <MessageDisplay
      id={currentPost.id}
      content={currentPost.content}
      user={currentPost.user}
      files={currentPost.files}
      currentUser={currentUser}
      onlineUsers={onlineUsers}
      messageType="post"
      threadCount={threadCount}
      onThreadOpen={() => onThreadOpen(currentPost)}
      onUpdate={handleUpdate}
      tableName="posts"
      className="mb-4"
      created_at={currentPost.created_at}
      translation={currentPost.translation}
    />
  )
} 