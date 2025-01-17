import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StorageObject {
  name: string
  bucket_id?: string
  owner?: string
  size?: number
  created_at?: string
  updated_at?: string
  last_accessed_at?: string
  metadata?: Record<string, any>
  id?: string
}

interface BucketResults {
  scanned: number
  deleted: number
  errors: string[]
  details: string[]
}

type StorageBucket = 'profile-pics' | 'file-uploads' | 'voice-messages' | 'tts_recordings'

async function listAllFiles(
  supabaseAdmin: any,
  bucket: string,
  path: string = ''
): Promise<{ files: StorageObject[], error: any }> {
  try {
    const { data, error } = await supabaseAdmin
      .storage
      .from(bucket)
      .list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (error) {
      console.error(`Error listing ${bucket}/${path}:`, error)
      return { files: [], error }
    }

    if (!data) {
      return { files: [], error: null }
    }

    let allFiles: StorageObject[] = []
    const files = data as StorageObject[]

    // Process directories
    const directories = files.filter(item => !item.metadata)
    const regularFiles = files.filter(item => item.metadata)

    // Add regular files with their full path
    allFiles.push(...regularFiles.map(file => ({
      ...file,
      name: path ? `${path}/${file.name}` : file.name
    })))

    // Recursively process directories
    for (const dir of directories) {
      const dirPath = path ? `${path}/${dir.name}` : dir.name
      const { files: nestedFiles, error: nestedError } = await listAllFiles(supabaseAdmin, bucket, dirPath)
      
      if (nestedError) {
        console.error(`Error listing files in ${dirPath}:`, nestedError)
        continue
      }

      allFiles.push(...nestedFiles)
    }

    return { files: allFiles, error: null }
  } catch (error) {
    console.error(`Unexpected error listing ${bucket}/${path}:`, error)
    return { files: [], error }
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for all operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    )

    // Initialize results object
    const results: Record<StorageBucket, BucketResults> = {
      'profile-pics': { scanned: 0, deleted: 0, errors: [], details: [] },
      'file-uploads': { scanned: 0, deleted: 0, errors: [], details: [] },
      'voice-messages': { scanned: 0, deleted: 0, errors: [], details: [] },
      'tts_recordings': { scanned: 0, deleted: 0, errors: [], details: [] }
    }

    try {
      // Clean up profile-pics bucket
      const { files: profilePics, error: profilePicsError } = await listAllFiles(supabaseAdmin, 'profile-pics')

      if (profilePicsError) {
        results['profile-pics'].errors.push(`Failed to list profile-pics: ${profilePicsError.message}`)
      } else {
        results['profile-pics'].scanned = profilePics.length
        results['profile-pics'].details.push(`Found ${profilePics.length} files in profile-pics bucket`)
        
        for (const file of profilePics) {
          try {
            // Check if file is referenced in user_profiles
            const { data: profile, error: profileError } = await supabaseAdmin
              .from('user_profiles')
              .select('profile_pic_url')
              .filter('profile_pic_url', 'ilike', `%${file.name}%`)
              .maybeSingle()

            if (profileError) {
              results['profile-pics'].details.push(`Error checking profile for ${file.name}: ${profileError.message}`)
              continue
            }

            if (!profile) {
              results['profile-pics'].details.push(`File ${file.name} not referenced in user_profiles`)
              // Delete orphaned file
              const { error: deleteError } = await supabaseAdmin
                .storage
                .from('profile-pics')
                .remove([file.name])

              if (deleteError) {
                results['profile-pics'].errors.push(`Failed to delete ${file.name}: ${deleteError.message}`)
              } else {
                results['profile-pics'].deleted++
                results['profile-pics'].details.push(`Successfully deleted ${file.name}`)
              }
            } else {
              results['profile-pics'].details.push(`File ${file.name} is referenced in user_profiles`)
            }
          } catch (error) {
            results['profile-pics'].errors.push(`Error processing ${file.name}: ${error.message}`)
          }
        }
      }
    } catch (error) {
      results['profile-pics'].errors.push(`Unexpected error in profile-pics: ${error.message}`)
    }

    // Clean up file-uploads and voice-messages buckets
    for (const bucket of ['file-uploads', 'voice-messages'] as const) {
      try {
        const { files: bucketFiles, error: listError } = await listAllFiles(supabaseAdmin, bucket)

        if (listError) {
          results[bucket].errors.push(`Failed to list ${bucket}: ${listError.message}`)
          continue
        }

        results[bucket].scanned = bucketFiles.length
        results[bucket].details.push(`Found ${bucketFiles.length} files in ${bucket} bucket`)

        for (const file of bucketFiles) {
          try {
            // Check if file is referenced in files table
            const { data: fileRecord, error: fileError } = await supabaseAdmin
              .from('files')
              .select('id')
              .eq('bucket', bucket)
              .eq('path', file.name)
              .maybeSingle()

            if (fileError) {
              results[bucket].details.push(`Error checking file record for ${file.name}: ${fileError.message}`)
              continue
            }

            if (!fileRecord) {
              results[bucket].details.push(`File ${file.name} not referenced in files table`)
              // Delete orphaned file
              const { error: deleteError } = await supabaseAdmin
                .storage
                .from(bucket)
                .remove([file.name])

              if (deleteError) {
                results[bucket].errors.push(`Failed to delete ${file.name}: ${deleteError.message}`)
                results[bucket].details.push(`Failed to delete ${file.name}: ${deleteError.message}`)
              } else {
                results[bucket].deleted++
                results[bucket].details.push(`Successfully deleted ${file.name}`)
              }
            } else {
              results[bucket].details.push(`File ${file.name} is referenced in files table`)
            }
          } catch (error) {
            results[bucket].errors.push(`Error processing ${file.name}: ${error.message}`)
          }
        }
      } catch (error) {
        results[bucket].errors.push(`Unexpected error in ${bucket}: ${error.message}`)
      }
    }

    try {
      // Clean up tts_recordings bucket
      const { files: ttsFiles, error: ttsListError } = await listAllFiles(supabaseAdmin, 'tts_recordings')

      if (ttsListError) {
        results['tts_recordings'].errors.push(`Failed to list tts_recordings: ${ttsListError.message}`)
      } else {
        results['tts_recordings'].scanned = ttsFiles.length
        results['tts_recordings'].details.push(`Found ${ttsFiles.length} files in tts_recordings bucket`)

        for (const file of ttsFiles) {
          try {
            // Extract content type and ID from filename (format: {type}_{id}.mp3)
            const [contentType, contentId] = file.name.split('.')[0].split('_')
            
            // Check if recording exists and is not in failed state
            const { data: ttsRecord, error: ttsError } = await supabaseAdmin
              .from('tts_recordings')
              .select('id, status, updated_at')
              .eq(`${contentType}_id`, contentId)
              .not('status', 'eq', 'failed')
              .maybeSingle()

            if (ttsError) {
              results['tts_recordings'].details.push(`Error checking TTS record for ${file.name}: ${ttsError.message}`)
              continue
            }

            const shouldDelete = !ttsRecord || (
              ttsRecord.status === 'failed' && 
              new Date(ttsRecord.updated_at) < new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours old
            )

            if (shouldDelete) {
              results['tts_recordings'].details.push(`File ${file.name} is orphaned or failed`)
              // Delete orphaned or failed file
              const { error: deleteError } = await supabaseAdmin
                .storage
                .from('tts_recordings')
                .remove([file.name])

              if (deleteError) {
                results['tts_recordings'].errors.push(`Failed to delete ${file.name}: ${deleteError.message}`)
                results['tts_recordings'].details.push(`Failed to delete ${file.name}: ${deleteError.message}`)
              } else {
                results['tts_recordings'].deleted++
                results['tts_recordings'].details.push(`Successfully deleted ${file.name}`)
              }
            } else {
              results['tts_recordings'].details.push(`File ${file.name} has valid TTS record`)
            }
          } catch (error) {
            results['tts_recordings'].errors.push(`Error processing ${file.name}: ${error.message}`)
          }
        }
      }
    } catch (error) {
      results['tts_recordings'].errors.push(`Unexpected error in tts_recordings: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: results
      }, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 