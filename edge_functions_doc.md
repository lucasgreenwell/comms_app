# Edge Functions Documentation

This document outlines all the edge functions deployed on our Supabase project.

## Process TTS (Text-to-Speech)

**Path**: `/process-tts`  
**Method**: POST  
**Authentication**: Requires service role key

### Description
Processes text content from posts (and in the future, messages and comments) to create text-to-speech recordings using OpenAI's TTS API. The function:
1. Fetches posts that don't have TTS recordings yet (or have failed recordings)
2. Creates a TTS recording entry in the database
3. Calls OpenAI's TTS API to generate audio
4. Stores the audio file in Supabase Storage
5. Updates the recording status

### Processing Rules
- Only processes posts that don't have an existing successful TTS recording
- Will attempt to reprocess posts with failed recordings
- Processes up to 5 posts per invocation to manage API rate limits
- Returns early with a success message if no posts need processing

### Required Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Your Supabase project URL (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (automatically set)

### Storage
Uses the `tts_recordings` bucket in Supabase Storage to store the generated audio files.

### Database Tables
Interacts with:
- `posts`: Reads post content
- `tts_recordings`: Creates and updates TTS recording entries

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
    post_id: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}
```

### Future Enhancements
- Support for processing messages from DMs
- Support for processing thread comments
- Support for different voices and languages
- Batch processing improvements 

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
- `conversation_thread_comments`: Reads DM thread comment content
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
- Support for more content types
- Real-time embedding generation
- Batch size optimization
- Advanced similarity search features 