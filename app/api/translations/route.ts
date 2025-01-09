import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v2 } from '@google-cloud/translate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Initialize Google Translate
const translate = new v2.Translate({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
})

async function translateText(text: string, targetLanguage: string) {
  try {
    const [translation] = await translate.translate(text, targetLanguage)
    return translation
  } catch (error) {
    console.error('Translation error:', error)
    return null
  }
}

async function createTranslations(
  content: string,
  messageId: string | null = null,
  conversationThreadCommentId: string | null = null,
  targetLanguage: string
) {
  try {
    const translation = await translateText(content, targetLanguage)
    if (!translation) return null

    const translationData: any = {
      created_at: new Date().toISOString()
    }

    // Set the appropriate translation field based on the target language
    switch (targetLanguage) {
      case 'zh':
        translationData.mandarin_chinese_translation = translation
        break
      case 'es':
        translationData.spanish_translation = translation
        break
      case 'en':
        translationData.english_translation = translation
        break
      case 'hi':
        translationData.hindi_translation = translation
        break
      case 'ar':
        translationData.arabic_translation = translation
        break
      case 'bn':
        translationData.bengali_translation = translation
        break
      case 'pt':
        translationData.portuguese_translation = translation
        break
      case 'ru':
        translationData.russian_translation = translation
        break
      case 'ja':
        translationData.japanese_translation = translation
        break
      case 'pa':
        translationData.western_punjabi_translation = translation
        break
      default:
        return null
    }

    // Set the appropriate ID field
    if (messageId) {
      translationData.message_id = messageId
    } else if (conversationThreadCommentId) {
      translationData.conversation_thread_comment_id = conversationThreadCommentId
    }

    const { data, error } = await supabase
      .from('translations')
      .insert([translationData])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error in createTranslations:', error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messageId, conversationThreadCommentId, senderId } = body

    if (!senderId || (!messageId && !conversationThreadCommentId)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the sender's native language
    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('native_language')
      .eq('id', senderId)
      .single()

    if (senderError) throw senderError

    // Get the recipient's native language
    let recipientId: string
    if (messageId) {
      // For direct messages, get the conversation participants
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('conversation_id')
        .eq('id', messageId)
        .single()

      if (messageError) throw messageError

      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', message.conversation_id)
        .neq('user_id', senderId)
        .single()

      if (participantsError) throw participantsError
      recipientId = participants.user_id
    } else {
      // For thread comments, get the original message sender
      const { data: comment, error: commentError } = await supabase
        .from('conversation_thread_comments')
        .select('message_id')
        .eq('id', conversationThreadCommentId)
        .single()

      if (commentError) throw commentError

      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('id', comment.message_id)
        .single()

      if (messageError) throw messageError
      recipientId = message.sender_id
    }

    // Get recipient's language preference
    const { data: recipient, error: recipientError } = await supabase
      .from('users')
      .select('native_language')
      .eq('id', recipientId)
      .single()

    if (recipientError) throw recipientError

    // Only translate if languages are different
    if (sender.native_language !== recipient.native_language) {
      // Get the message content
      let content: string
      if (messageId) {
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .select('content')
          .eq('id', messageId)
          .single()

        if (messageError) throw messageError
        content = message.content
      } else {
        const { data: comment, error: commentError } = await supabase
          .from('conversation_thread_comments')
          .select('content')
          .eq('id', conversationThreadCommentId)
          .single()

        if (commentError) throw commentError
        content = comment.content
      }

      // Get the language code for translation
      const { data: recipientLanguage, error: languageError } = await supabase
        .from('top_languages')
        .select('code')
        .eq('id', recipient.native_language)
        .single()

      if (languageError) throw languageError

      // Create the translation
      const translation = await createTranslations(
        content,
        messageId,
        conversationThreadCommentId,
        recipientLanguage.code
      )

      return NextResponse.json(translation)
    }

    return NextResponse.json({ message: 'No translation needed' })
  } catch (error) {
    console.error('Error in translation endpoint:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 