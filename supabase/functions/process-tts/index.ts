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

type ContentType = 'post' | 'message' | 'post_thread_comment' | 'conversation_thread_comment';

interface ContentItem {
  id: string;
  content: string;
  type: ContentType;
  user_id: string;
}

async function fetchContentWithoutTTS(supabaseClient: any): Promise<ContentItem[]> {
  const results: ContentItem[] = [];

  // Fetch posts with user_id
  const { data: posts, error: postsError } = await supabaseClient.rpc('posts_without_tts');
  if (postsError) throw postsError;
  results.push(...posts.filter(p => p.content?.trim()).map(p => ({ ...p, type: 'post' as ContentType })));

  // Fetch messages with user_id
  const { data: messages, error: messagesError } = await supabaseClient.rpc('messages_without_tts');
  if (messagesError) throw messagesError;
  results.push(...messages.filter(m => m.content?.trim()).map(m => ({ ...m, type: 'message' as ContentType })));

  // Fetch post thread comments with user_id
  const { data: postComments, error: postCommentsError } = await supabaseClient.rpc('post_thread_comments_without_tts');
  if (postCommentsError) throw postCommentsError;
  results.push(...postComments.filter(pc => pc.content?.trim()).map(pc => ({ ...pc, type: 'post_thread_comment' as ContentType })));

  // Fetch conversation thread comments with user_id
  const { data: convComments, error: convCommentsError } = await supabaseClient.rpc('conversation_thread_comments_without_tts');
  if (convCommentsError) throw convCommentsError;
  results.push(...convComments.filter(cc => cc.content?.trim()).map(cc => ({ ...cc, type: 'conversation_thread_comment' as ContentType })));

  return results;
}

async function getUserVoiceClone(supabaseClient: any, userId: string): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('users')
    .select('eleven_labs_clone_id')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data.eleven_labs_clone_id;
}

async function generateTTSWithElevenLabs(text: string, voiceId: string): Promise<ArrayBuffer> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY') || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      `Failed to generate TTS with ElevenLabs: ${response.status} ${response.statusText}` +
      (errorData ? ` - ${JSON.stringify(errorData)}` : '')
    );
  }

  return await response.arrayBuffer();
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

    const items = await fetchContentWithoutTTS(supabaseClient);

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [], message: "No new content to process" }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const results = []

    for (const item of items) {
      try {
        // Validate content before processing
        if (!item.content?.trim()) {
          console.error(`Empty content found for ${item.type} ${item.id}`);
          results.push({ 
            content_type: item.type, 
            content_id: item.id, 
            status: 'failed', 
            error: 'Empty content' 
          });
          continue;
        }

        // Create data object for TTS recording entry
        const data: Record<string, any> = {
          status: 'processing',
          storage_path: `${item.type}_${item.id}.mp3`
        };

        // Set the appropriate foreign key based on content type
        switch (item.type) {
          case 'post':
            data.post_id = item.id;
            break;
          case 'message':
            data.message_id = item.id;
            break;
          case 'post_thread_comment':
            data.post_thread_comment_id = item.id;
            break;
          case 'conversation_thread_comment':
            data.conversation_thread_comment_id = item.id;
            break;
        }

        // Create a TTS recording entry
        const { data: ttsRecord, error: ttsError } = await supabaseClient
          .from('tts_recordings')
          .insert(data)
          .select()
          .single()

        if (ttsError) throw ttsError

        // Check if user has a voice clone
        const voiceCloneId = await getUserVoiceClone(supabaseClient, item.user_id);
        let audioBuffer: ArrayBuffer;

        if (voiceCloneId) {
          // Use ElevenLabs if user has a voice clone
          audioBuffer = await generateTTSWithElevenLabs(item.content, voiceCloneId);
        } else {
          // Fall back to OpenAI TTS if no voice clone
          const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: item.content,
          });
          audioBuffer = await response.arrayBuffer();
        }

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseClient
          .storage
          .from('tts_recordings')
          .upload(`${item.type}_${item.id}.mp3`, audioBuffer, {
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

        results.push({ content_type: item.type, content_id: item.id, status: 'success' })
      } catch (error) {
        // Update status to failed
        const updateData: Record<string, any> = {
          status: 'failed',
          error_message: error.message
        };

        switch (item.type) {
          case 'post':
            updateData.post_id = item.id;
            break;
          case 'message':
            updateData.message_id = item.id;
            break;
          case 'post_thread_comment':
            updateData.post_thread_comment_id = item.id;
            break;
          case 'conversation_thread_comment':
            updateData.conversation_thread_comment_id = item.id;
            break;
        }

        await supabaseClient
          .from('tts_recordings')
          .update(updateData)
          .eq(item.type + '_id', item.id)

        results.push({ content_type: item.type, content_id: item.id, status: 'failed', error: error.message })
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
