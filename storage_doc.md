# Supabase Storage Documentation

This document outlines the storage buckets used in our application and their interactions across different components.

## Storage Buckets

We maintain four separate storage buckets in Supabase:

1. `profile-pics`
2. `file-uploads`
3. `tts_recordings`
4. `voice-messages`

### profile-pics Bucket

This bucket is dedicated to storing user profile pictures.

#### Usage Locations:

1. **User Creation (`createUsers.js`)**
   - Used during initial user setup to upload default profile pictures
   - Handles both upload and public URL generation for profile pictures
   - Supports both PNG and JPEG formats

2. **Profile Management (`app/profile/page.tsx`)**
   - Handles user profile picture updates
   - File naming convention: `{userId}/{timestamp}.{fileExtension}`
   - Supports upsert operations to replace existing profile pictures
   - Generates and stores public URLs in the `user_profiles` table

### file-uploads Bucket

This bucket handles general file attachments in conversations and channels.

#### Usage Locations:

1. **Message Display (`app/components/MessageDisplay.tsx`)**
   - Handles file downloads for attachments
   - Manages file deletions (only by the original uploader)
   - Includes error handling and user feedback via toast notifications

2. **Direct Messages (`app/dm/[id]/page.tsx`)**
   - Handles file attachments in direct messages

3. **Channel Messages (`app/channel/[channelId]/page.tsx`)**
   - Manages file attachments in channel conversations

4. **Thread Comments**
   - Both conversation threads (`app/dm/ConversationThreadComments.tsx`)
   - And channel threads (`app/channel/[channelId]/ThreadComments.tsx`)
   - Support file attachments in threaded discussions

### tts_recordings Bucket

This bucket stores text-to-speech audio files generated from various content types.

#### Usage Locations:

1. **Edge Function (`process-tts`)**
   - Stores TTS audio files generated from posts, messages, and comments
   - File naming convention: `{content_type}_{content_id}.mp3`
   - Supports upsert operations to replace failed recordings
   - Files are referenced in the `tts_recordings` table

2. **Message Display Components**
   - `MessageDisplay.tsx` and related components fetch and play TTS recordings
   - Provides accessibility features through audio playback
   - Handles streaming of audio content

#### Content Types:
- Posts
- Messages
- Post thread comments
- Conversation thread comments

### voice-messages Bucket

This bucket stores user-recorded voice messages and audio recordings.

#### Usage Locations:

1. **Voice Recorder (`app/components/VoiceRecorder.tsx`)**
   - Handles recording and uploading of voice messages
   - File naming convention: `{userId}/{timestamp}.webm`
   - Supports WebM audio format for optimal compression

2. **Voice Message Player (`app/components/VoiceMessage.tsx`)**
   - Manages playback of voice messages
   - Handles streaming and buffering of audio content
   - Provides playback controls and progress tracking

3. **Message Components**
   - Integration in direct messages and channels
   - Support for voice messages in thread comments
   - Handles voice message attachments like other file types

## Common Operations

### File Upload
- All buckets support upsert operations
- Files are typically stored with unique identifiers or paths
- Content types are properly set during upload
- Audio files use appropriate compression formats

### File Access
- All buckets generate public URLs for stored files
- Downloads are handled through the Supabase storage client
- Access control is managed through Supabase policies
- Audio streaming is optimized for different network conditions

### File Deletion
- File deletion is restricted to file owners/uploaders
- Includes cleanup of storage items when associated content is deleted
- TTS recordings are managed by the system and cleaned up automatically

### Automated Cleanup
- Runs every 15 minutes via edge function
- Scans all buckets recursively (including subdirectories)
- Removes files that are no longer referenced in their respective tables:
  - `profile-pics`: Removes files not referenced in `user_profiles.profile_pic_url`
  - `file-uploads` and `voice-messages`: Removes files not referenced in `files` table
  - `tts_recordings`: Removes files not referenced in `tts_recordings` table or failed recordings older than 24 hours
- Provides detailed logging of cleanup operations
- Uses service role key for secure access to private buckets

## Security Considerations

- Profile pictures are associated with user IDs
- File deletions are restricted to original uploaders
- Public URLs are used for serving content
- Error handling is implemented across all storage operations
- Audio content is properly sanitized and validated
- Automated cleanup uses service role for secure access

## Best Practices

1. Always use proper error handling when interacting with storage
2. Clean up files when associated content is deleted
3. Validate file types and sizes before upload
4. Use appropriate file naming conventions for each bucket
5. Implement proper access control through Supabase policies
6. Use appropriate audio formats and compression for voice content
7. Handle audio streaming efficiently to optimize bandwidth usage 