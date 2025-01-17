# Edge Functions Documentation

This document outlines all the edge functions deployed on our Supabase project.

## Process TTS (Text-to-Speech)

**Path**: `/process-tts`  
**Method**: POST  
**Authentication**: Requires service role key

### Description
Processes text content from posts, messages, thread comments, and conversation thread comments to create text-to-speech recordings using either ElevenLabs (for users with voice clones) or OpenAI's TTS API (as fallback). The function:
1. Fetches content that doesn't have TTS recordings yet
2. Checks if the content author has an ElevenLabs voice clone
3. Creates a TTS recording entry in the database
4. Generates audio using either ElevenLabs (if user has a voice clone) or OpenAI's TTS API
5. Stores the audio file in Supabase Storage
6. Updates the recording status

### Processing Rules
- Only processes content that doesn't have an existing TTS recording
- Automatically deletes failed recordings before reprocessing
- Skips empty content or whitespace-only content
- Handles duplicate processing attempts gracefully
- Uses personalized voice clones when available

### Required Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `SUPABASE_URL`: Your Supabase project URL (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (automatically set)

### Storage
Uses the `tts_recordings` bucket in Supabase Storage to store the generated audio files.

### Database Tables
Interacts with:
- `posts`: Reads post content
- `messages`: Reads message content
- `post_thread_comments`: Reads thread comment content
- `conversation_thread_comments`: Reads conversation thread comment content
- `tts_recordings`: Creates and updates TTS recording entries
- `users`: Checks for ElevenLabs voice clone IDs

### Example Usage
```bash
curl -i --location --request POST 'https://[PROJECT_REF].functions.supabase.co/process-tts' \
  --header 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
  --header 'Content-Type: application/json'
```

### Response Format
```typescript
{
  success: boolean;
  results: Array<{
    content_type: 'post' | 'message' | 'post_thread_comment' | 'conversation_thread_comment';
    content_id: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    message?: string;
  }>;
}
```

### Voice Generation Details
#### ElevenLabs Configuration
- Uses `eleven_multilingual_v2` model
- Voice settings:
  - Stability: 0.5
  - Similarity Boost: 0.75

#### OpenAI Configuration (Fallback)
- Uses `tts-1` model
- Default voice: "alloy"

### Error Handling
- Gracefully handles duplicate processing attempts
- Provides detailed error messages from both APIs
- Marks recordings as failed with error messages for debugging
- Automatically cleans up failed recordings for retry

### Future Enhancements
- Support for different fallback voices
- Batch processing improvements
- Voice customization parameters
- Real-time processing option
- Support for additional TTS providers

## Process Embeddings

**Path**: `/process-embeddings`  
**Method**: POST  
**Authentication**: Requires service role key

### Description
Processes text content from posts, messages, and comments to create vector embeddings using OpenAI's text-embedding-3-large model. The function:
1. Fetches content that doesn't have embeddings yet
2. Calls OpenAI's embedding API to generate vectors
3. Stores the embeddings in the vector_embeddings table
4. Supports multiple content types (posts, messages, thread comments)

### Required Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Your Supabase project URL (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (automatically set)

### Database Tables
Interacts with:
- `posts`: Reads post content
- `messages`: Reads message content
- `post_thread_comments`: Reads thread comment content
- `conversation_thread_comments`: Reads conversation thread comment content
- `vector_embeddings`: Stores the generated embeddings

### Example Usage
```bash
curl -i --location --request POST 'https://[PROJECT_REF].functions.supabase.co/process-embeddings' \
  --header 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
  --header 'Content-Type: application/json'
```

### Response Format
```typescript
{
  success: boolean;
  results: Array<{
    content_type: 'post' | 'message' | 'post_thread_comment' | 'conversation_thread_comment';
    content_id: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}
```

### Technical Details
- Uses OpenAI's `text-embedding-3-large` model
- Embeddings are 3072-dimensional vectors
- Supports semantic search across all content types
- Automatically processes new content that doesn't have embeddings

### Performance Considerations
- Processes content in batches to avoid rate limits
- Uses pgvector for efficient vector similarity search
- Embeddings are normalized for consistent similarity comparisons

### Future Enhancements
- Real-time embedding generation
- Batch size optimization
- Advanced similarity search features
- Custom embedding models for specific content types 

## Cleanup Storage

**Path**: `/cleanup-storage`  
**Method**: POST  
**Authentication**: Requires service role key

### Description
Automatically cleans up orphaned files in Supabase storage buckets every 15 minutes. The function:
1. Recursively scans all storage buckets (including subdirectories)
2. Checks each file against its corresponding database table
3. Removes files that are no longer referenced
4. Handles failed TTS recordings older than 24 hours
5. Provides detailed logging of all operations

### Storage Buckets Cleaned
1. `profile-pics`: Removes profile pictures not referenced in `user_profiles.profile_pic_url`
2. `file-uploads` and `voice-messages`: Removes files not referenced in the `files` table
3. `tts_recordings`: Removes recordings that are either:
   - Not referenced in the `tts_recordings` table
   - In 'failed' state and older than 24 hours

### Required Environment Variables
- `SUPABASE_URL`: Your Supabase project URL (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (automatically set)

### Database Tables
Interacts with:
- `user_profiles`: Checks profile picture references
- `files`: Checks file attachments and voice messages
- `tts_recordings`: Checks TTS recording status and references

### Example Usage
```bash
curl -X POST 'https://[PROJECT_REF].functions.supabase.co/cleanup-storage' \
  -H 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
  -H 'Content-Type: application/json'
```

### Response Format
```typescript
{
  success: boolean;
  data: {
    profile_pics: {
      scanned: number;
      deleted: number;
      errors: string[];
      details: string[];
    };
    file_uploads: {
      scanned: number;
      deleted: number;
      errors: string[];
      details: string[];
    };
    voice_messages: {
      scanned: number;
      deleted: number;
      errors: string[];
      details: string[];
    };
    tts_recordings: {
      scanned: number;
      deleted: number;
      errors: string[];
      details: string[];
    };
  };
}
```

### Technical Details
- Uses recursive directory scanning
- Handles nested file structures
- Maintains full file paths for accurate matching
- Uses service role for secure access to private buckets
- Provides detailed operation logging
- Handles errors gracefully without stopping the process

### Error Handling
- Each bucket's cleanup operation runs independently
- Errors in one bucket don't affect others
- All errors are logged in the response
- Function continues execution even if some operations fail
- Detailed error messages for debugging

### Cron Schedule
Runs every 15 minutes using the cron expression:
```
*/15 * * * *
```

### Future Enhancements
- Configurable retention periods for failed recordings
- Batch processing for large storage buckets
- Customizable cleanup rules per bucket
- Detailed cleanup logs and metrics
- Support for additional file types and matching rules 