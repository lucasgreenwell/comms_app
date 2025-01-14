import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createTranslations, getLanguages } from '../translations/utils'

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
    // Fetch posts with file attachments and translations
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id, 
        user_id, 
        channel_id, 
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
        ),
        translations (
          id,
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
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })

    if (postsError) throw postsError

    // Fetch user data
    const userIds = [...new Set(posts.map(post => post.user_id))]
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, display_name, native_language')
      .in('id', userIds)

    if (usersError) throw usersError

    // Transform posts to include files array and user info
    const postsWithUserInfo = posts.map(post => ({
      ...post,
      user: users?.find(user => user.id === post.user_id) || { id: post.user_id, email: 'Unknown User', display_name: null },
      files: post.file_attachments?.map(attachment => attachment.files) || [],
      translation: post.translations?.[0] || null
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
    const { postId, userId } = body

    if (!postId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the post content
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('content')
      .eq('id', postId)
      .single()

    if (postError) throw postError
    if (!post) throw new Error('Post not found')

    // Get languages data
    const languagesData = await getLanguages()

    // Create translations
    const translation = await createTranslations(
      post.content,
      null, // messageId
      null, // conversationThreadCommentId
      postId,
      null, // postThreadCommentId
      languagesData
    )

    return NextResponse.json(translation)
  } catch (error) {
    console.error('Error creating translations:', error)
    return NextResponse.json({ error: 'Failed to create translations' }, { status: 500 })
  }
}

