import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface UserLanguageData {
  native_language: string
  language_preference: {
    language: string
  }
}

export async function POST(request: Request) {
  try {
    const { content, conversationId, senderId, recipientId } = await request.json()

    // First check if the recipient has AI assistant enabled
    const { data: recipientData, error: recipientError } = await supabase
      .from('users')
      .select('ai_assistant_enabled, display_name')
      .eq('id', recipientId)
      .single()

    if (recipientError) {
      throw new Error(`Error fetching recipient data: ${JSON.stringify(recipientError)}`)
    }

    if (!recipientData.ai_assistant_enabled) {
      return NextResponse.json({ 
        success: true, 
        message: `AI assistant is not enabled for user ${recipientData.display_name}`
      })
    }

    // Get user's language preference
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        native_language,
        language_preference:top_languages!users_native_language_fkey (
          language
        )
      `)
      .eq('id', recipientId)
      .single()

    if (userError) {
      throw new Error(`Error fetching user data: ${JSON.stringify(userError)}`)
    }

    const typedUserData = userData as unknown as UserLanguageData

    // Fetch all user's messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('sender_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (messagesError) {
      throw new Error(`Error fetching messages: ${JSON.stringify(messagesError)}`)
    }

    // Fetch all user's posts
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('content, created_at')
      .eq('user_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (postsError) {
      throw new Error(`Error fetching posts: ${JSON.stringify(postsError)}`)
    }

    // Fetch all user's thread comments
    const { data: threadComments, error: threadError } = await supabase
      .from('post_thread_comments')
      .select('content, created_at')
      .eq('user_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (threadError) {
      throw new Error(`Error fetching thread comments: ${JSON.stringify(threadError)}`)
    }

    // Combine all content chronologically
    const allContent = [
      ...messages.map(m => ({ content: m.content, created_at: m.created_at, type: 'message' })),
      ...posts.map(p => ({ content: p.content, created_at: p.created_at, type: 'post' })),
      ...threadComments.map(t => ({ content: t.content, created_at: t.created_at, type: 'thread comment' }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Format context from all content
    const context = allContent.length 
      ? allContent
          .map(item => `[${new Date(item.created_at).toLocaleString()}] (${item.type}): ${item.content}`)
          .join('\n')
      : "No previous content found."

    // Get chat completion from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant responding on behalf of the user. Use their previous messages and content as context to provide a natural response that matches their communication style. Respond in ${typedUserData.language_preference.language || 'English'} language.`
        },
        {
          role: "user",
          content: `Here is the context from the user's previous messages and posts:\n\n${context}\n\nRespond to this message: ${content}. Be concise and to the point. Do not attempt to be conversational or ask follow up questions. When you can not answer the question, respond with "I cannot answer that question, but the user can help you with that as soon as they are available." When answering, you should be responding in first person as if you are the user.`
        }
      ]
    })

    const aiResponse = completion.choices[0].message.content
    if (!aiResponse) {
      throw new Error('No response received from OpenAI')
    }

    // Add prefix to AI response
    const messageContent = `<span class="font-bold text-lg">${recipientData.display_name || 'User'}'s AI Assistant:</span> ${aiResponse}`

    // Save AI's response as a new message
    const { data: aiMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        content: messageContent,
        conversation_id: conversationId,
        sender_id: recipientId
      })
      .select()
      .single()

    if (messageError) throw messageError

    return NextResponse.json({ success: true, message: aiMessage })
  } catch (error) {
    console.error('Error in ai-response route:', error)
    return NextResponse.json(
      { error: 'Failed to process AI response' },
      { status: 500 }
    )
  }
} 