import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('messageId')

  if (!messageId) {
    return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
  }

  try {
    type CommentResponse = {
      id: string;
      user_id: string;
      message_id: string;
      conversation_id: string;
      content: string;
      created_at: string;
      files: {
        id: string;
        file: {
          id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          path: string;
        };
      }[] | null;
    }

    // Fetch thread comments with user info and files
    const { data: comments, error: commentsError } = await supabase
      .from('conversation_thread_comments')
      .select(`
        id,
        user_id,
        message_id,
        conversation_id,
        content,
        created_at,
        files:file_attachments(
          id,
          file:file_id(
            id,
            file_name,
            file_type,
            file_size,
            path
          )
        )
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true })

    if (commentsError) throw commentsError

    // Transform the comments to include file information
    const transformedComments = (comments as unknown as CommentResponse[]).map(comment => ({
      ...comment,
      files: comment.files?.map(f => ({
        id: f.file.id,
        file_name: f.file.file_name,
        file_type: f.file.file_type,
        file_size: f.file.file_size,
        path: f.file.path
      }))
    }))

    // Fetch user data
    const userIds = [...new Set(transformedComments.map(comment => comment.user_id))]
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, display_name')
      .in('id', userIds)

    if (usersError) throw usersError

    // Combine comment data with user data
    const commentsWithUserInfo = transformedComments.map(comment => ({
      ...comment,
      user: users?.find(user => user.id === comment.user_id) || { id: comment.user_id, email: 'Unknown User', display_name: null }
    }))

    return NextResponse.json(commentsWithUserInfo)
  } catch (error) {
    console.error('Error in /api/conversation-thread-comments:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messageId, conversationId, postThreadCommentId, messageThreadCommentId, userId, content } = body

    if (!userId || !content || (!messageId && !conversationId && !postThreadCommentId && !messageThreadCommentId)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const insertData: any = {
      user_id: userId,
      content: content.trim()
    };

    if (messageId) insertData.message_id = messageId;
    if (conversationId) insertData.conversation_id = conversationId;
    if (postThreadCommentId) insertData.post_thread_comment_id = postThreadCommentId;
    if (messageThreadCommentId) insertData.message_thread_comment_id = messageThreadCommentId;

    const { data: commentData, error } = await supabase
      .from('conversation_thread_comments')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(commentData)
  } catch (error) {
    console.error('Error creating thread comment:', error)
    return NextResponse.json({ error: 'Failed to create thread comment' }, { status: 500 })
  }
} 