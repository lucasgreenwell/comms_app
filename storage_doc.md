# Supabase Storage Documentation

This document outlines the storage buckets used in our application and their interactions across different components.

## Storage Buckets

We maintain two separate storage buckets in Supabase:

1. `profile-pics`
2. `file-uploads`

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

## Common Operations

### File Upload
- Both buckets support upsert operations
- Files are typically stored with unique identifiers or paths
- Content types are properly set during upload

### File Access
- Both buckets generate public URLs for stored files
- Downloads are handled through the Supabase storage client
- Access control is managed through Supabase policies

### File Deletion
- File deletion is restricted to file owners/uploaders
- Includes cleanup of storage items when associated content is deleted

## Security Considerations

- Profile pictures are associated with user IDs
- File deletions are restricted to original uploaders
- Public URLs are used for serving content
- Error handling is implemented across all storage operations

## Best Practices

1. Always use proper error handling when interacting with storage
2. Clean up files when associated content is deleted
3. Validate file types and sizes before upload
4. Use appropriate file naming conventions for each bucket
5. Implement proper access control through Supabase policies 