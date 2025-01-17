# Direct Messages Directory Documentation

## Overview
The Direct Messages (DM) directory contains components and functionality for handling one-on-one and group messaging in the Slack clone application. It implements real-time messaging, thread discussions, file attachments, voice messages, message translations, and read receipts.

## Directory Structure
```
app/dm/
├── [id]/
│   └── page.tsx                      # Main DM conversation page component
├── MessageItem.tsx                   # Individual message component
├── ConversationThreadComments.tsx    # Thread discussion component with voice notes
├── ConversationThreadCommentItem.tsx # Individual thread comment component with translations
└── StartChatModal.tsx               # Modal for starting new conversations
```

## Type Definitions

The type definitions for this feature have been moved to centralized type directories:

### Entity Types (`app/types/entities/`)
- `Message.ts` - Message entity interface
- `User.ts` - User entity interface
- `Conversation.ts` - Conversation entity interface
- `FileAttachment.ts` - File attachment entity interface
- `Translation.ts` - Translation entity interface

### Props Types (`app/types/props/`)
- `MessageItemProps.ts` - Props for MessageItem component
- `StartChatModalProps.ts` - Props for StartChatModal component

## TypeScript Types

### Entity Types
```typescript
// User
interface User {
  id: string
  email: string
  display_name?: string | null
  native_language?: string | null
}

// Message
interface Message {
  id: string
  content: string
  created_at: string
  sender: User
  files?: FileAttachment[]
  translation: Translation | null
}

// FileAttachment
interface FileAttachment {
  id: string
  file_name: string
  file_type: string
  file_size: number
  path: string
  bucket: string
  duration_seconds?: number
}

// Translation
interface Translation {
  id: string
  message_id: string | null
  conversation_thread_comment_id: string | null
  post_id: string | null
  post_thread_comment_id: string | null
  mandarin_chinese_translation: string | null
  spanish_translation: string | null
  english_translation: string | null
  hindi_translation: string | null
  arabic_translation: string | null
  bengali_translation: string | null
  portuguese_translation: string | null
  russian_translation: string | null
  japanese_translation: string | null
  western_punjabi_translation: string | null
}

// Conversation
interface Conversation {
  id: string
  type: 'dm' | 'group'
  name: string | null
}
```

## User Interaction Flows

### Message Creation Flow
1. User enters message content and/or selects files, or records a voice message
2. Frontend:
   - Creates message record in `messages` table
   - Uploads any attached files to Supabase storage
   - Creates file records in `files` table with duration for voice messages
   - Links files to message in `file_attachments` table
3. Real-time Updates:
   - Other users receive message via Supabase real-time subscription
   - Translation service processes text messages
   - Users receive translation updates via subscription
   - Unread counts are updated for other participants

### Voice Message Flow
1. User clicks voice message button
2. Frontend:
   - Shows voice recorder UI
   - Handles microphone permissions
   - Provides record/stop controls
   - Shows preview playback
3. User records message:
   - Can preview before sending
   - Can cancel recording
   - Can re-record if needed
4. Backend Process:
   - Uploads MP3 file to `voice-messages` bucket
   - Creates file record in `files` table with duration
   - Creates message with empty content
   - Creates file attachment linking the voice message
5. Real-time Updates:
   - Other users receive message via subscription
   - Voice message appears with playback controls
6. Error Handling:
   - Shows toast notification on success/failure
   - Handles microphone permission errors
   - Handles upload failures

### File Upload Flow
1. User selects files through the UI or records a voice message
2. Files are uploaded to appropriate Supabase storage bucket:
   - Regular files go to 'file-uploads'
   - Voice messages go to 'voice-messages'
3. File records are created in the `files` table with:
   - Basic metadata (name, type, size, path)
   - Additional fields for voice messages (duration_seconds)
4. File attachments are linked to messages/comments

### Thread Comment Flow
1. User clicks thread icon on a message
2. Thread view opens in sidebar
3. User can:
   - View thread history
   - Add new comments
   - Upload files to comments
   - Record voice messages
   - React with emojis
4. Real-time Updates:
   - Other users in thread receive updates via subscription
   - Parent message thread count updates automatically
   - Translation updates are received in real-time
5. Voice Messages in Threads:
   - Same functionality as main messages
   - Records duration for playback
   - Shows audio player UI
   - Supports preview before sending
6. Translation in Threads:
   - Thread comments support translations like main messages
   - Translations are fetched with comment data
   - Translations update in real-time via subscription
   - Hover over message to see translation tooltip
   - Respects user's native language preference

### Read Receipt Flow
1. User opens conversation
2. Frontend:
   - Updates `last_read_at` in `conversation_participants` table
   - Clears unread count for this conversation
3. Real-time Updates:
   - Sidebar unread counts update for the user
   - Other users can see read status

## Components

### 1. DM Page (`[id]/page.tsx`)

#### Purpose
Main component for displaying and managing direct message conversations.

#### Key Features
- Real-time messaging
- File attachments
- Voice message recording/playback
- Message threading
- Online presence indicators
- Read receipts
- Message translations

#### Key Functions
1. `sendMessage(e: React.FormEvent)`
   - Handles message submission
   - Manages file uploads
   - Updates read receipts

2. `handleVoiceRecordingComplete(audioBlob: Blob, duration: number)`
   - Handles voice message recording completion
   - Uploads audio file to voice-messages bucket
   - Creates file record with duration
   - Creates message and file attachment

3. `setupRealtimeSubscription()`
   - Sets up real-time listeners for messages and files
   - Manages Supabase channel subscriptions

4. `updateLastReadTimestamp()`
   - Updates read receipts
   - Manages unread message counts

### 2. ConversationThreadComments Component (`ConversationThreadComments.tsx`)

#### Purpose
Manages thread discussions for individual messages.

#### Key Features
- Thread comment display
- File attachments in threads
- Voice message recording/playback
- Real-time updates
- Emoji reactions
- Translation support

#### Database Operations
All database operations are handled directly in the component using Supabase client:
- Fetching thread comments with translations and files
- Creating new comments
- Uploading files and voice messages
- Managing file attachments
- Triggering translations

#### Key Functions
1. `fetchComments()`
   - Fetches thread comments with user info, files, and translations
   - Transforms data to match component types

2. `handleSubmit(e: React.FormEvent)`
   - Handles comment submission
   - Manages file uploads
   - Creates comment records
   - Links file attachments

3. `handleVoiceRecordingComplete(audioBlob: Blob, duration: number)`
   - Processes voice message recordings
   - Uploads to voice-messages bucket
   - Creates file and comment records
   - Handles translations

4. `setupRealtimeSubscription()`
   - Manages real-time updates for comments
   - Handles file attachment changes
   - Updates thread state
   - Handles translation updates

### 3. ConversationThreadCommentItem Component (`ConversationThreadCommentItem.tsx`)

#### Purpose
Renders individual comments within a thread discussion.

#### Key Features
- Comment display with user information
- File attachment display
- Voice message playback
- Translation support with hover tooltip
- Online user status integration
- Real-time translation updates

### 4. StartChatModal Component (`StartChatModal.tsx`)

#### Purpose
Provides a modal interface for users to start new direct message conversations or group chats.

#### Key Features
- User selection with search functionality
- Support for both one-on-one and group chats
- Online presence indicators
- Pre-selected user support
- Theme-aware styling
- Keyboard navigation (Escape to close)

#### Key Functions
1. `fetchUsers()`
   - Retrieves list of available users for chat
   - Excludes current user from results
   - Orders users by email

2. `handleStartChat()`
   - Checks for existing conversations
   - Creates new conversation if none exists
   - Handles both DM and group chat creation
   - Manages participant relationships

## Database Schema

### Messages Table
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id),
    sender_id UUID REFERENCES users(id),
    content TEXT,
    created_at TIMESTAMPTZ
);
```

### Conversation Thread Comments Table
```sql
CREATE TABLE conversation_thread_comments (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id),
    message_id UUID REFERENCES messages(id),
    user_id UUID REFERENCES users(id),
    content TEXT,
    created_at TIMESTAMPTZ
);
```

### Files Table
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    bucket TEXT NOT NULL,
    path TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### File Attachments Table
```sql
CREATE TABLE file_attachments (
    id UUID PRIMARY KEY,
    file_id UUID REFERENCES files(id),
    message_id UUID REFERENCES messages(id),
    conversation_thread_comment_id UUID REFERENCES conversation_thread_comments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_parent_only CHECK (
        (message_id IS NOT NULL AND conversation_thread_comment_id IS NULL) OR
        (message_id IS NULL AND conversation_thread_comment_id IS NOT NULL)
    )
);
```

## Real-time Features

The application uses Supabase's real-time functionality for:

1. Message Updates
```typescript
channel.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  },
  (payload) => {
    fetchMessages()
  }
)
```

2. Thread Comment Updates
```typescript
channel.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'conversation_thread_comments',
    filter: `message_id=eq.${messageId}`
  },
  (payload) => {
    fetchComments()
  }
)
```

3. File Attachment Updates
```typescript
channel.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'file_attachments',
    filter: `conversation_thread_comment_id=in.(${commentIds.join(',')})`
  },
  () => {
    fetchComments()
  }
)
```

4. Translation Updates
```typescript
channel.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'translations',
    filter: `conversation_thread_comment_id=eq.${commentId}`
  },
  (payload) => {
    fetchComments()
  }
)
```

## Error Handling

The application implements comprehensive error handling for:
- Failed message sends
- File upload errors
- Voice recording errors
- Network issues
- Authentication errors
- Real-time subscription failures
- Translation service errors

Each error is caught and displayed to the user via toast notifications.

## Bot Conversations

### Overview
The application includes two types of AI assistance:
1. A dedicated AI assistant bot (ID: '54296b9b-091e-4a19-b5b9-b890c24c1912') that uses Retrieval-Augmented Generation (RAG) to provide context-aware responses.
2. Personal AI assistants that can respond on behalf of users when they enable the feature in their profile settings.

### Personal AI Assistant
Users can enable an AI assistant to respond on their behalf in direct messages. When enabled:
- The AI assistant uses the user's previous messages, posts, and comments as context
- Responses are prefixed with "[User]'s AI Assistant:"
- Responses match the user's communication style based on their historical content
- Messages are sent in the user's preferred language
- The assistant respects user permissions and only accesses content the user has created

### RAG Implementation
Both the bot and personal assistants use comprehensive vector search across multiple content types:
- Channel posts
- Post thread comments
- Direct messages
- DM thread comments

All content is embedded using OpenAI's text-embedding-3-large model and stored in the vector_embeddings table.

### Content Access Control
The bot's RAG system respects user permissions:
- Only searches posts/threads from channels the user is a member of
- Only searches DMs/threads from conversations the user participates in
- Uses the match_all_content database function to enforce these permissions

### Message Flow
1. User sends message to bot
2. System:
   - Fetches user's language preference from top_languages table (using language name)
   - Generates embedding for user's message
3. Vector similarity search finds relevant content
4. Content is formatted with:
   - Source information
   - Creation timestamps
   - Location context (channel/DM)
5. GPT-4 generates response using:
   - Retrieved context
   - User's message
   - System prompt (in user's preferred language)
6. Response includes:
   - Bot's answer (in user's preferred language)
   - Clickable source links to relevant content
   - Similarity scores for transparency

### Source Attribution
Bot responses include clickable source links that:
- Link directly to the referenced content
- Support different content types (posts, threads, DMs)
- Include thread context when applicable
- Open in new tabs for easy reference
- Show creation timestamps for context

### Database Function
The match_all_content function handles RAG queries with:
- Vector similarity search
- Permission checks
- Content type identification
- Relevance scoring
- Source metadata
- Timestamp information

### Response Format
Bot messages are structured as:
1. Main response text (in user's preferred language, using full language name)
2. Source references (if relevant content found)
3. Clickable links to source content
4. Similarity scores and timestamps for transparency

### Integration Points
- MessageInput component checks for bot conversations
- Sends messages to /api/bot-messages endpoint
- Handles bot responses via real-time subscriptions
- Displays bot messages with source links
- Respects user's language preferences from profile settings (using language name instead of code) 