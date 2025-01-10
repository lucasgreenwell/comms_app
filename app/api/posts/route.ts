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
    const { channelId, userId, content } = body

    if (!channelId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Only create post if there's content or files will be attached
    if (!content?.trim() && !body.files?.length) {
      return NextResponse.json({ error: 'Post must have content or files' }, { status: 400 })
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        channel_id: channelId,
        user_id: userId,
        content: content?.trim() || ''
      })
      .select()
      .single()

    if (error) throw error

    // Fetch user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, display_name, native_language')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    // Create translations for the post
    if (content?.trim()) {
      try {
        const languagesData = await getLanguages();
        await createTranslations(
          content.trim(),
          null, // messageId
          null, // conversationThreadCommentId
          post.id, // postId
          null, // postThreadCommentId
          languagesData
        );
      } catch (translationError) {
        console.error('Error creating translations:', translationError);
        // Don't throw error here, just log it - we still want to return the post
      }
    }

    // Return post with user information
    const postWithUser = {
      ...post,
      user,
      files: [],
      translation: null
    }

    return NextResponse.json(postWithUser)
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}

