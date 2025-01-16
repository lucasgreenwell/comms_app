# Direct Messages Directory Documentation

## Overview
The Direct Messages (DM) directory contains components and functionality for handling one-on-one and group messaging in the Slack clone application. It implements real-time messaging, thread discussions, file attachments, message translations, and read receipts.

## Directory Structure
```
app/dm/
├── [id]/
│   └── page.tsx                      # Main DM conversation page component
├── MessageItem.tsx                   # Individual message component
├── ConversationThreadComments.tsx    # Thread discussion component
├── ConversationThreadCommentItem.tsx # Individual thread comment component
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
   - React with emojis
4. Real-time Updates:
   - Other users in thread receive updates via subscription
   - Parent message thread count updates automatically

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
- Real-time updates
- Emoji reactions

#### API Endpoints Used
- `GET /api/conversation-thread-comments?messageId={messageId}` - Fetch thread comments
- `POST /api/conversation-thread-comments` - Create new thread comment

#### Key Functions
1. `setupRealtimeSubscription()`
   - Manages real-time updates for comments
   - Handles file attachment changes
   - Updates thread state

### 3. ConversationThreadCommentItem Component (`ConversationThreadCommentItem.tsx`)

#### Purpose
Renders individual comments within a thread discussion.

#### Key Features
- Comment display with user information
- File attachment display
- Translation support
- Online user status integration

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

### Conversations Table
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    type TEXT CHECK (type IN ('dm', 'group')),
    name TEXT,
    created_at TIMESTAMPTZ
);
```

### Conversation Participants Table
```sql
CREATE TABLE conversation_participants (
    conversation_id UUID REFERENCES conversations(id),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ,
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
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
    filter: `message_id=eq.${messageId}`
  },
  (payload) => {
    fetchMessages()
  }
)
```

## API Request/Response Formats

### Message Operations
Messages are handled directly through Supabase connections rather than API routes. Here are the key operations:

#### Create Message
```typescript
// Insert message
const { data, error } = await supabase
  .from('messages')
  .insert({
    conversation_id: string,
    sender_id: string,
    content: string,
    created_at: string
  })
  .select()
```

#### Fetch Messages
```typescript
const { data, error } = await supabase
  .from('messages')
  .select(`
    id,
    content,
    created_at,
    sender:sender_id(
      id,
      email,
      display_name,
      native_language
    ),
    files:file_attachments(
      id,
      file:file_id(
        id,
        file_name,
        file_type,
        file_size,
        path
      )
    ),
    translations(*)
  `)
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true })
```

### Thread Comments API Endpoints

#### Fetch Thread Comments
```typescript
GET /api/conversation-thread-comments?messageId={messageId}

Response: ThreadComment[]
```

#### Create Thread Comment
```typescript
POST /api/conversation-thread-comments
{
  messageId: string
  conversationId: string
  userId: string
  content: string
}

Response: {
  id: string
  content: string
  created_at: string
  user_id: string
}
```

## Error Handling

The application implements comprehensive error handling for:
- Failed message sends
- File upload errors
- Network issues
- Authentication errors
- Real-time subscription failures

Each error is caught and displayed to the user via toast notifications. 