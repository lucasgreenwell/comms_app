// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.24.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })

    // Fetch posts that need TTS processing using our SQL function
    const { data: posts, error: postsError } = await supabaseClient
      .rpc('posts_without_tts')

    if (postsError) {
      throw postsError
    }

    // If no posts need processing, return early
    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [], message: "No new posts to process" }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const results = []

    for (const post of posts) {
      try {
        // Create a TTS recording entry
        const { data: ttsRecord, error: ttsError } = await supabaseClient
          .from('tts_recordings')
          .insert({
            post_id: post.id,
            status: 'processing',
            storage_path: `${post.id}.mp3`
          })
          .select()
          .single()

        if (ttsError) throw ttsError

        // Call OpenAI's TTS API
        const response = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: post.content,
        })

        // Convert the response to a Buffer
        const audioBuffer = await response.arrayBuffer()

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseClient
          .storage
          .from('tts_recordings')
          .upload(`${post.id}.mp3`, audioBuffer, {
            contentType: 'audio/mp3',
            upsert: true
          })

        if (uploadError) throw uploadError

        // Update status to completed
        const { error: updateError } = await supabaseClient
          .from('tts_recordings')
          .update({ status: 'completed' })
          .eq('id', ttsRecord.id)

        if (updateError) throw updateError

        results.push({ post_id: post.id, status: 'success' })
      } catch (error) {
        // Update status to failed
        await supabaseClient
          .from('tts_recordings')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('post_id', post.id)

        results.push({ post_id: post.id, status: 'failed', error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/process-tts' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
