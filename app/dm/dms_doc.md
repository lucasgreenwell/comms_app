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

## User Interaction Flows

### Message Creation Flow
1. User enters message content and/or selects files
2. Frontend:
   - Creates message record in `messages` table
   - Uploads any attached files to Supabase storage
   - Creates file records in `files` table
   - Links files to message in `file_attachments` table
3. Real-time Updates:
   - Other users receive message via Supabase real-time subscription
   - Translation service processes the message
   - Users receive translation updates via subscription
   - Unread counts are updated for other participants

### File Upload Flow
1. User selects files through the UI
2. Files are uploaded to Supabase storage
3. File records are created in the `files` table
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
- Message threading
- Online presence indicators
- Read receipts
- Message translations

#### Key Components and Functions

##### State Management
```typescript
interface Message {
  id: string
  content: string
  created_at: string
  sender: {
    id: string
    email: string
    display_name?: string | null
  }
  files?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    path: string
  }[]
  translation: Translation | null
}

// Main state variables
const [messages, setMessages] = useState<Message[]>([])
const [conversation, setConversation] = useState<Conversation | null>(null)
const [participants, setParticipants] = useState<Participant[]>([])
const [activeThread, setActiveThread] = useState<{...} | null>(null)
```

##### Key Functions
1. `sendMessage(e: React.FormEvent)`
   - Handles message submission
   - Manages file uploads
   - Updates read receipts

2. `setupRealtimeSubscription()`
   - Sets up real-time listeners for messages and files
   - Manages Supabase channel subscriptions

3. `updateLastReadTimestamp()`
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

#### Component Interface
```typescript
interface ThreadComment {
  id: string
  user_id: string
  message_id: string
  conversation_id: string
  content: string
  created_at: string
  user: {
    id: string
    email: string
    display_name?: string | null
  }
  files?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    path: string
  }[]
}
```

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

#### Component Interface
```typescript
interface StartChatModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedUserId?: string
  customHeader?: string
  showStartChatAnimation?: boolean
}
```

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

Response: {
  id: string
  content: string
  created_at: string
  user: {
    id: string
    email: string
    display_name?: string
  }
  files?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    path: string
  }[]
}[]
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

## Type Definitions

### Translation Type
```typescript
interface Translation {
  id: string;
  message_id: string | null;
  conversation_thread_comment_id: string | null;
  post_id: string | null;
  post_thread_comment_id: string | null;
  mandarin_chinese_translation: string | null;
  spanish_translation: string | null;
  english_translation: string | null;
  hindi_translation: string | null;
  arabic_translation: string | null;
  bengali_translation: string | null;
  portuguese_translation: string | null;
  russian_translation: string | null;
  japanese_translation: string | null;
  western_punjabi_translation: string | null;
}
```

### Message Type
```typescript
interface Message {
  id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    email: string;
    display_name?: string | null;
  };
  files?: {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    path: string;
  }[];
  translation: Translation | null;
}
```

### Thread Comment Type
```typescript
interface ThreadComment {
  id: string;
  user_id: string;
  message_id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    email: string;
    display_name?: string | null;
  };
  files?: {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    path: string;
  }[];
} 