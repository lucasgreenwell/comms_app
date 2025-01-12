'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '../../auth'
import { useUser } from '../../hooks/useUser'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LogOut, Paperclip, X } from 'lucide-react'
import PostItem from './PostItem'
import ThreadComments from './ThreadComments'
import { useToast } from "@/components/ui/use-toast"
import { Post } from '@/app/types/post'
import type { Channel } from '@/app/types/entities/Channel'

export default function Channel() {
  const { channelId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: currentUser } = useUser()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [channel, setChannel] = useState<Channel | null>(null)
  const [activeThread, setActiveThread] = useState<{
    postId: string;
    content: string;
    created_at: string;
    user: {
      id: string;
      email: string;
      display_name?: string | null;
      native_language?: string | null;
    };
    translation?: {
      id: string;
      message_id: string | null;
      conversation_thread_comment_id: string | null;
      post_id: string | null;
      post_thread_comment_id: string | null;
      mandarin_chinese_translation: string | null;
      spanish_translation: string | null;
      english_translation: string | null;
      hindi_translation: string | null;
      arabic_translation: string | null;
      bengali_translation: string | null;
      portuguese_translation: string | null;
      russian_translation: string | null;
      japanese_translation: string | null;
      western_punjabi_translation: string | null;
    } | null;
  } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const tourStep = Number(searchParams.get('tourStep')) || 0

  useEffect(() => {
    fetchChannel()
    fetchPosts()
    const cleanup = setupRealtimeSubscription()
    return () => {
      cleanup()
    }
  }, [channelId])

  useEffect(() => {
    scrollToBottom()
  }, [posts])

  useEffect(() => {
    const threadId = searchParams.get('thread')
    if (threadId && posts.length > 0) {
      const post = posts.find(p => p.id === threadId)
      if (post) {
        setActiveThread({
          postId: post.id,
          content: post.content,
          created_at: post.created_at,
          user: post.user,
          translation: post.translation
        })
      }
    }
  }, [searchParams, posts])

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

    // Get all post IDs and file IDs for filters
    const postIds = posts.map(p => p.id)
    const fileIds = posts.flatMap(p => p.files || []).map(f => f.id)

    let channel = supabase.channel(`public:posts:channel_id=eq.${channelId}`)

    // Listen for post changes
    channel = channel.on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'posts', 
        filter: `channel_id=eq.${channelId}` 
      }, 
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const fetchUserDetails = async (userId: string) => {
            const { data: user, error } = await getSupabase()
              .from('users')
              .select('id, email, display_name')
              .eq('id', userId)
              .single();
            if (error) {
              console.error('Error fetching user details:', error);
              return { id: 'unknown', email: 'unknown', display_name: 'unknown' };
            }
            return user;
          };

          fetchUserDetails(payload.new.user_id).then(user => {
            const newPost: Post = {
              id: payload.new.id,
              user_id: payload.new.user_id,
              channel_id: payload.new.channel_id,
              content: payload.new.content,
              created_at: payload.new.created_at,
              user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name || user.email
              }
            };
            setPosts(prevPosts => [...prevPosts, newPost]);
          });
        } else if (payload.eventType === 'UPDATE') {
          setPosts(prevPosts => 
            prevPosts.map(post => 
              post.id === payload.new.id ? { ...post, ...payload.new } : post
            )
          )
        } else if (payload.eventType === 'DELETE') {
          setPosts(prevPosts => prevPosts.filter(post => post.id !== payload.old?.id))
        }
      }
    )

    // Only add file_attachments subscription if we have posts
    if (postIds.length > 0) {
      channel = channel.on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'file_attachments',
          filter: `post_id=in.(${postIds.join(',')})`
        },
        () => {
          // Instead of refetching, update the posts state
          const fetchPostFiles = async () => {
            const { data: attachments } = await getSupabase()
              .from('file_attachments')
              .select(`
                post_id,
                file:files(
                  id,
                  file_name,
                  file_type,
                  file_size,
                  path
                )
              `)
              .in('post_id', postIds);

            if (attachments) {
              const filesByPostId = attachments.reduce((acc: any, curr) => {
                if (!acc[curr.post_id]) {
                  acc[curr.post_id] = [];
                }
                if (curr.file) {
                  acc[curr.post_id].push(curr.file);
                }
                return acc;
              }, {});

              setPosts(prevPosts => 
                prevPosts.map(post => ({
                  ...post,
                  files: filesByPostId[post.id] || []
                }))
              );
            }
          };
          fetchPostFiles();
        }
      )
    }

    // Only add files subscription if we have files
    if (fileIds.length > 0) {
      channel = channel.on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: `id=in.(${fileIds.join(',')})`
        },
        () => {
          // Instead of refetching, update the posts state
          const fetchUpdatedFiles = async () => {
            const { data: files } = await getSupabase()
              .from('files')
              .select('*')
              .in('id', fileIds);

            if (files) {
              setPosts(prevPosts => 
                prevPosts.map(post => ({
                  ...post,
                  files: post.files?.map(f => 
                    files.find(newFile => newFile.id === f.id) || f
                  )
                }))
              );
            }
          };
          fetchUpdatedFiles();
        }
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Re-subscribe when posts change to update the file_attachments filter
  useEffect(() => {
    const cleanup = setupRealtimeSubscription()
    return () => {
      cleanup()
    }
  }, [posts.length])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && selectedFiles.length === 0) return

    // Create a temporary post for optimistic update
    const tempPost: Post = {
      id: `temp-${Date.now()}`, // temporary ID that will be replaced
      user_id: currentUser?.id || '',
      channel_id: channelId as string,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      user: {
        id: currentUser?.id || '',
        email: currentUser?.email || '',
        display_name: currentUser?.display_name,
        native_language: currentUser?.native_language
      },
      files: [], // Will be updated after file upload
      translation: null
    }

    try {
      if (!currentUser) throw new Error('User not authenticated')

      // Optimistically add the post to the state
      setPosts(prevPosts => [...prevPosts, tempPost])
      
      // Clear input immediately for better UX
      setNewMessage('')
      const filesToUpload = [...selectedFiles]
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // First, upload any files
      const filePromises = filesToUpload.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${currentUser.id}/${fileName}`

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
            uploaded_by: currentUser.id
          })
          .select()
          .single()

        if (fileRecordError) throw fileRecordError

        return fileData
      })

      const uploadedFiles = await Promise.all(filePromises)

      // Create post
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId,
          userId: currentUser.id,
          content: newMessage.trim(),
          fileIds: uploadedFiles.map(file => file.id)
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const actualPost = await response.json()

      // Replace the temporary post with the actual one
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id.startsWith('temp-') ? { ...actualPost, files: uploadedFiles } : post
        )
      )
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove the temporary post if there was an error
      setPosts(prevPosts => prevPosts.filter(post => post.id !== tempPost.id))
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      })
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
      if (!currentUser) throw new Error('User not authenticated')

      const supabase = getSupabase()
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', currentUser.id)

      if (error) throw error

      router.push('/')
    } catch (error) {
      console.error('Error leaving channel:', error)
      toast({
        title: "Error",
        description: "Failed to leave channel",
        variant: "destructive",
      })
    }
  }

  const handleThreadOpen = (post: Post) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('thread', post.id)
    router.push(`/channel/${channelId}?${newSearchParams.toString()}`)
    setActiveThread({
      postId: post.id,
      content: post.content,
      created_at: post.created_at,
      user: post.user,
      translation: post.translation
    })
  }

  const handleThreadClose = () => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.delete('thread')
    router.push(`/channel/${channelId}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`)
    setActiveThread(null)
  }

  if (loading) return <div>Loading posts...</div>
  if (error) return <div className="text-red-500">{error}</div>

  return (
    <div className="flex h-full">
      <div className={`flex-1 flex flex-col h-full w-full`}>
        <div className="flex justify-between items-center mb-4 w-full min-w-0 p-4">
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
              <PostItem 
                key={post.id} 
                post={post} 
                onPostUpdate={(updatedPost: Post) => {
                  setPosts(prevPosts =>
                    prevPosts.map(post =>
                      post.id === updatedPost.id ? { ...post, content: updatedPost.content } : post
                    )
                  );
                }}
                onThreadOpen={handleThreadOpen}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <form onSubmit={handleSendMessage} className="space-y-2 p-4">
          <div className="flex gap-2">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className={`flex-1 ${
                tourStep === 2 ? 'ring-4 ring-offset-2 ring-blue-500 ring-offset-background animate-slow-pulse' : ''
              } transition-all duration-300`}
            />
            <Button 
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className={`${
                tourStep === 2 ? 'scale-110 animate-slow-pulse ring-4 ring-offset-2 ring-blue-500 ring-offset-background' : ''
              } transition-all duration-300`}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button 
              type="submit"
              className={`${
                tourStep === 2 ? 'scale-110 animate-slow-pulse ring-4 ring-offset-2 ring-blue-500 ring-offset-background' : ''
              } transition-all duration-300`}
            >
              Send
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
                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
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
      {activeThread && (
        <ThreadComments 
          postId={activeThread.postId} 
          originalPost={{
            id: activeThread.postId,
            content: activeThread.content,
            created_at: activeThread.created_at,
            user: activeThread.user,
            translation: activeThread.translation
          }}
          onClose={handleThreadClose} 
        />
      )}
    </div>
  )
}

