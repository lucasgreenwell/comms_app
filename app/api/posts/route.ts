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
  const channelId = searchParams.get('channelId')

  if (!channelId) {
    return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
  }

  try {
    // Fetch posts
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, user_id, channel_id, content, created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })

    if (postsError) throw postsError

    // Fetch user data
    const userIds = [...new Set(posts.map(post => post.user_id))]
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
      filter: `id.in.(${userIds.join(',')})`
    })

    if (usersError) throw usersError

    // Combine post data with user data
    const postsWithUserInfo = posts.map(post => ({
      ...post,
      user: users.find(user => user.id === post.user_id) || { id: post.user_id, email: 'Unknown User' }
    }))

    return NextResponse.json(postsWithUserInfo)
  } catch (error) {
    console.error('Error in /api/posts:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { channelId, userId, content } = body

    if (!channelId || !userId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { error } = await supabase
      .from('posts')
      .insert({
        channel_id: channelId,
        user_id: userId,
        content: content.trim()
      })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}

