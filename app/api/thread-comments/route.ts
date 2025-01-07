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
  const postId = searchParams.get('postId')

  if (!postId) {
    return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
  }

  try {
    // Fetch thread comments with file attachments
    const { data: comments, error: commentsError } = await supabase
      .from('post_thread_comments')
      .select(`
        id, 
        user_id, 
        post_id, 
        content, 
        created_at,
        file_attachments (
          file_id,
          files (
            id,
            file_name,
            file_type,
            file_size,
            path
          )
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (commentsError) throw commentsError

    // Fetch user data
    const userIds = [...new Set(comments.map(comment => comment.user_id))]
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds)

    if (usersError) throw usersError

    // Transform comments to include files array
    const commentsWithUserInfo = comments.map(comment => ({
      ...comment,
      user: users?.find(user => user.id === comment.user_id) || { id: comment.user_id, email: 'Unknown User' },
      files: comment.file_attachments?.map(attachment => attachment.files) || []
    }))

    return NextResponse.json(commentsWithUserInfo)
  } catch (error) {
    console.error('Error in /api/thread-comments:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { postId, userId, content } = body

    if (!postId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Only create comment if there's content or files will be attached
    if (!content?.trim() && !body.files?.length) {
      return NextResponse.json({ error: 'Comment must have content or files' }, { status: 400 })
    }

    const { data: comment, error } = await supabase
      .from('post_thread_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: content?.trim() || ''
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(comment)
  } catch (error) {
    console.error('Error creating thread comment:', error)
    return NextResponse.json({ error: 'Failed to create thread comment' }, { status: 500 })
  }
} 