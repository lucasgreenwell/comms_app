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

const BOT_USER_ID = '54296b9b-091e-4a19-b5b9-b890c24c1912'

export async function POST(request: Request) {
  try {
    const { content, conversationId, senderId } = await request.json()

    // Generate embedding for the user's message
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: content,
      encoding_format: "float"
    })

    console.log('Generated embedding length:', embedding.data[0].embedding.length)

    // Perform vector similarity search with posts instead of messages
    const { data: similarPosts, error: searchError } = await supabase.rpc('match_posts', {
      query_embedding: embedding.data[0].embedding,
      match_threshold: 0.0,
      match_count: 3
    })

    if (searchError) {
      console.error('Search error details:', JSON.stringify(searchError))
    }
    
    // Format context from similar posts, or use empty context if none found
    const context = similarPosts?.length 
      ? similarPosts
          .map((post: any) => `${post.display_name}: ${post.content} (similarity: ${post.similarity.toFixed(3)})`)
          .join('\n')
      : "No relevant context found."

    // Create source links
    const sources = similarPosts?.length
      ? '\n\nSources:\n' + similarPosts
          .map((post: any, index: number) => 
            `<a href="/channel/${post.channel_id}?thread=${post.post_id}" target="_blank" rel="noopener noreferrer" class="text-blue-500">[${index + 1}]</a>`
          )
          .join('\n')
      : ''

    // Get chat completion from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant in a chat application. Use the provided context to help answer the user's question. If no relevant context is found, respond based on your general knowledge. Keep responses concise and friendly. Your response must be a valid JSON object with two fields: 'response' (your text response) and 'relevant_sources' (an array of indices of the provided sources that contained the information requested by the user)."
        },
        {
          role: "user",
          content: `Context from posts throughout the company's slack:\n${context}\n\nUser's message: ${content}`
        }
      ],
      response_format: { type: "json_object" }
    })

    // Parse the JSON response
    const messageContent = completion.choices[0].message.content
    if (!messageContent) {
      throw new Error('No response received from OpenAI')
    }
    const aiResponse = JSON.parse(messageContent)

    // Filter sources to only include the ones marked as relevant
    const relevantSources = similarPosts?.length && aiResponse.relevant_sources.length
      ? '\n\nSources:\n' + aiResponse.relevant_sources
          .map((index: number) => {
            const post = similarPosts[index]
            return `<a href="/channel/${post.channel_id}?thread=${post.post_id}" target="_blank" rel="noopener noreferrer" class="text-blue-500" title="Opens in new tab">[${index + 1}]</a>`
          })
          .join('\n')
      : ''

    // Combine bot's response with filtered sources
    const responseWithSources = aiResponse.response + relevantSources

    // Save bot's response as a new message
    const { data: botMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        content: responseWithSources,
        conversation_id: conversationId,
        sender_id: BOT_USER_ID
      })
      .select()
      .single()

    if (messageError) throw messageError

    return NextResponse.json({ success: true, message: botMessage })
  } catch (error) {
    console.error('Error in bot-messages route:', error)
    return NextResponse.json(
      { error: 'Failed to process bot message' },
      { status: 500 }
    )
  }
} 