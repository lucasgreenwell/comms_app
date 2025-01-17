import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StorageObject {
  name: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: Record<string, any>
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results: Record<string, any> = {
      profile_pics: { scanned: 0, deleted: 0, errors: [] },
      file_uploads: { scanned: 0, deleted: 0, errors: [] },
      voice_messages: { scanned: 0, deleted: 0, errors: [] },
      tts_recordings: { scanned: 0, deleted: 0, errors: [] }
    }

    // Clean up profile-pics bucket
    const { data: profilePics, error: profilePicsError } = await supabaseClient
      .storage
      .from('profile-pics')
      .list()

    if (profilePicsError) {
      results.profile_pics.errors.push(`Failed to list profile-pics: ${profilePicsError.message}`)
    } else if (profilePics) {
      results.profile_pics.scanned = profilePics.length
      for (const file of profilePics) {
        // Check if file is referenced in user_profiles
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('profile_pic_url')
          .filter('profile_pic_url', 'ilike', `%${file.name}%`)
          .maybeSingle()

        if (!profile) {
          // Delete orphaned file
          const { error: deleteError } = await supabaseClient
            .storage
            .from('profile-pics')
            .remove([file.name])

          if (deleteError) {
            results.profile_pics.errors.push(`Failed to delete ${file.name}: ${deleteError.message}`)
          } else {
            results.profile_pics.deleted++
          }
        }
      }
    }

    // Clean up file-uploads and voice-messages buckets
    for (const bucket of ['file-uploads', 'voice-messages']) {
      const { data: files, error: listError } = await supabaseClient
        .storage
        .from(bucket)
        .list()

      if (listError) {
        results[bucket].errors.push(`Failed to list ${bucket}: ${listError.message}`)
        continue
      }

      if (files) {
        results[bucket].scanned = files.length
        for (const file of files) {
          // Check if file is referenced in files table
          const { data: fileRecord } = await supabaseClient
            .from('files')
            .select('id')
            .eq('bucket', bucket)
            .eq('path', file.name)
            .maybeSingle()

          if (!fileRecord) {
            // Delete orphaned file
            const { error: deleteError } = await supabaseClient
              .storage
              .from(bucket)
              .remove([file.name])

            if (deleteError) {
              results[bucket].errors.push(`Failed to delete ${file.name}: ${deleteError.message}`)
            } else {
              results[bucket].deleted++
            }
          }
        }
      }
    }

    // Clean up tts_recordings bucket
    const { data: ttsFiles, error: ttsListError } = await supabaseClient
      .storage
      .from('tts_recordings')
      .list()

    if (ttsListError) {
      results.tts_recordings.errors.push(`Failed to list tts_recordings: ${ttsListError.message}`)
    } else if (ttsFiles) {
      results.tts_recordings.scanned = ttsFiles.length
      for (const file of ttsFiles) {
        // Extract content type and ID from filename (format: {type}_{id}.mp3)
        const [contentType, contentId] = file.name.split('.')[0].split('_')
        
        // Check if recording exists and is not in failed state
        const { data: ttsRecord } = await supabaseClient
          .from('tts_recordings')
          .select('id, status, updated_at')
          .eq(`${contentType}_id`, contentId)
          .not('status', 'eq', 'failed')
          .maybeSingle()

        const shouldDelete = !ttsRecord || (
          ttsRecord.status === 'failed' && 
          new Date(ttsRecord.updated_at) < new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours old
        )

        if (shouldDelete) {
          // Delete orphaned or failed file
          const { error: deleteError } = await supabaseClient
            .storage
            .from('tts_recordings')
            .remove([file.name])

          if (deleteError) {
            results.tts_recordings.errors.push(`Failed to delete ${file.name}: ${deleteError.message}`)
          } else {
            results.tts_recordings.deleted++
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 