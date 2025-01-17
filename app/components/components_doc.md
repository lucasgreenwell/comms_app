# Components Directory Documentation

## Overview
The components directory contains reusable UI components used throughout the application. These components are built with TypeScript and follow a consistent type system.

## Directory Structure
```
app/components/
├── MessageDisplay.tsx      # Message display component with emoji reactions, file attachments, and TTS
├── Notification.tsx        # Toast notification component
├── SearchModal.tsx         # Global search modal component
├── Sidebar.tsx            # Main navigation sidebar component
├── StartChatModal.tsx     # Modal for starting new direct messages
├── TourPopup.tsx          # Tour guide popup component
├── UserDisplay.tsx        # User avatar and status display component
├── VoiceMessage.tsx       # Audio player for voice messages
└── VoiceRecorder.tsx      # Voice recording component for sending audio messages
```

## Type Definitions

The type definitions for this feature have been moved to centralized type directories:

### Entity Types (`app/types/entities/`)
- `Channel.ts` - Channel entity interface
- `DirectMessage.ts` - Direct message conversation interface
- `EmojiReaction.ts` - Emoji reaction entity interface
- `File.ts` - File attachment entity interface
- `Post.ts` - Post entity interface

### Props Types (`app/types/props/`)
- `MessageDisplayProps.ts` - Props for MessageDisplay component
- `StartChatModalProps.ts` - Props for StartChatModal component
- `TourPopupProps.ts` - Props for TourPopup component
- `UserDisplayProps.ts` - Props for UserDisplay component

## Components

### 1. MessageDisplay Component (`MessageDisplay.tsx`)

#### Purpose
Displays individual messages with support for emoji reactions, file attachments, and translations.

#### Key Features
- Message content display
- File attachments with download/delete capabilities
- Emoji reactions
- Message editing and deletion
- Translation support
- Thread discussion support

#### Emoji Reaction System

The MessageDisplay component includes a comprehensive emoji reaction system that allows users to react to messages with emojis. This functionality is built on top of the `emoji_reactions` table in the database.

##### Database Integration
The system uses the following table structure:
```sql
emoji_reactions
- id: UUID (Primary Key)
- message_id: UUID (FK to messages.id)
- post_id: UUID (FK to posts.id)
- conversation_thread_comment_id: UUID (FK to conversation_thread_comments.id)
- post_thread_comment_id: UUID (FK to post_thread_comments.id)
- created_at: TIMESTAMPTZ
- user_id: UUID (FK to users.id)
- emoji: TEXT
```

##### Key Functions

1. **Loading Reactions** (`loadReactions`)
   - Fetches reactions for the current message/post
   - Handles different message types (post, dm, thread)
   - Updates local state with fetched reactions

2. **Adding Reactions** (`handleAddReaction`)
   - Adds new emoji reaction to the database
   - Updates UI optimistically
   - Handles error cases with toast notifications

3. **Removing Reactions** (`handleRemoveReaction`)
   - Removes user's reaction from the database
   - Updates UI optimistically
   - Only allows users to remove their own reactions

4. **Real-time Updates**
   - Subscribes to Supabase real-time changes
   - Updates reactions instantly when others react
   - Handles INSERT and DELETE events

##### UI Features

1. **Emoji Picker**
   - Grid-based emoji selection interface
   - Pagination support for multiple emoji pages
   - Accessible via the smile icon button

2. **Reaction Display**
   - Groups identical reactions together
   - Shows reaction count
   - Highlights user's own reactions with theme color
   - Hover effects for interaction feedback

3. **Theme Integration**
   - Uses application theme colors
   - Semi-transparent background for user's reactions
   - Consistent hover states

##### Usage Example
```typescript
// Subscribing to real-time updates
useEffect(() => {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`reactions:${id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'emoji_reactions',
        filter: `message_id=eq.${id}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setReactions(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'DELETE') {
          setReactions(prev => prev.filter(r => r.id !== payload.old.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [id]);
```

### 2. Sidebar Component (`Sidebar.tsx`)

#### Purpose
Main navigation component that displays channels and direct messages.

#### Key Features
- Channel list with join/create functionality
- Direct messages list
- Online presence indicators
- Unread message counts
- Search functionality
- Tour guide integration

### 3. UserDisplay Component (`UserDisplay.tsx`)

#### Purpose
Displays user information with avatar and online status.

#### Key Features
- User avatar with fallback initials
- Online/offline status indicator
- Display name with email fallback
- Profile picture support

### 4. TourPopup Component (`TourPopup.tsx`)

#### Purpose
Provides guided tour functionality for new users.

#### Key Features
- Step-by-step tour guide
- Customizable positioning
- Progress tracking
- Dismissible interface

### 5. Notification Component (`Notification.tsx`)

#### Purpose
Handles toast notifications throughout the application.

#### Key Features
- Toast notifications
- Customizable positioning
- Multiple notification types

### 6. StartChatModal Component (`StartChatModal.tsx`)

#### Purpose
Modal component for initiating new direct message conversations.

#### Key Features
- User selection interface
- Pre-selected user support
- Custom header text
- Animation support for tour integration
- Integration with tour guide functionality

### 7. VoiceMessage Component (`VoiceMessage.tsx`)

#### Purpose
Provides an audio player interface for voice messages with playback controls and progress tracking.

#### Key Features
- Audio playback controls (play/pause)
- Progress bar with current time and duration
- Automatic URL signing for secure audio access
- Error handling for audio loading and playback
- Time formatting for duration display

#### Usage Example
```typescript
<VoiceMessage
  fileName="audio.mp3"
  bucket="voice-messages"
  path="user/123/audio.mp3"
  duration={120} // duration in seconds
/>
```

### 8. VoiceRecorder Component (`VoiceRecorder.tsx`)

#### Purpose
Enables users to record and send voice messages within the chat interface.

#### Key Features
- Microphone access and recording controls
- Live preview of recorded audio
- Duration tracking
- Blob handling for audio data
- Permission handling and error messaging
- Cancel and send functionality

#### Usage Example
```typescript
<VoiceRecorder
  onRecordingComplete={(blob, duration) => {
    // Handle the recorded audio blob and duration
  }}
  onCancel={() => {
    // Handle recording cancellation
  }}
/>
```

### 9. Text-to-Speech Integration

The application includes a comprehensive text-to-speech (TTS) system integrated into the MessageDisplay component. This system allows messages to be read aloud, improving accessibility and user experience.

#### Key Features
- Automatic TTS generation for messages
- Playback controls in the message interface
- Support for multiple content types (messages, posts, thread comments)
- Caching of generated audio for improved performance
- Error handling for TTS generation and playback

#### Database Integration
The TTS system uses the following table structure:
```sql
tts_recordings
- id: UUID (Primary Key)
- content_id: UUID (FK to messages/posts/comments)
- content_type: TEXT (message, post, thread_comment)
- audio_path: TEXT
- status: TEXT (pending, completed, failed)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### Implementation Details
1. **TTS Generation Process**
   - When a message is sent, a background job is triggered to generate TTS
   - The audio file is stored in Supabase storage
   - The recording status is tracked in the database

2. **Playback Integration**
   - The TTSPlayer component checks for existing recordings
   - Only displays if a recording is completed
   - Provides play/pause functionality
   - Handles loading and error states

3. **Content Type Handling**
```typescript
type ContentType = 'message' | 'post' | 'conversation_thread_comment' | 'post_thread_comment';

interface TTSPlayerProps {
  contentType: ContentType;
  contentId: string;
}
```

#### Usage Example
```typescript
<TTSPlayer
  contentType="message"
  contentId="message-uuid"
/>
```

### MessageInput Component (`MessageInput.tsx`)

#### Purpose
Handles user input for sending messages, including text, file attachments, and voice messages.

#### Key Features
- Text input with placeholder support
- File attachment handling with preview and removal
- Voice message recording and preview before sending
- Integration with AI response for direct messages

#### Voice Message Preview
- Users can record a voice message using the integrated `VoiceRecorder`.
- A preview of the recorded voice message is displayed below the input field.
- Users can play back the voice message to verify before sending.
- The preview can be removed by clicking the delete button.
- The voice message is uploaded and sent when the user clicks the send button.

#### Usage Example
```typescript
<MessageInput
  messageType="dm"
  parentId="conversation-id"
  placeholder="Type your message..."
  participants={[{ id: 'user-id' }]}
/>
```

## Usage Examples

### MessageDisplay Component
```typescript
import MessageDisplay from './MessageDisplay'
import type { MessageDisplayProps } from '@/app/types/props/MessageDisplayProps'

<MessageDisplay
  id="message-id"
  content="Hello world!"
  user={currentUser}
  messageType="dm"
  onUpdate={handleUpdate}
  tableName="messages"
  created_at={new Date().toISOString()}
/>
```

### UserDisplay Component
```typescript
import UserDisplay from './UserDisplay'
import type { UserDisplayProps } from '@/app/types/props/UserDisplayProps'

<UserDisplay
  user={user}
  showPresence={true}
  isOnline={true}
/>
```

### TourPopup Component
```typescript
import { TourPopup } from './TourPopup'
import type { TourPopupProps } from '@/app/types/props/TourPopupProps'

<TourPopup
  title="Welcome!"
  content="Let's get started with a quick tour."
  onClose={handleClose}
  currentStep={1}
  totalSteps={5}
/>
```

## State Management

Components use a combination of local state and global state management:

1. Local State (useState)
   - UI state (editing, hovering, etc.)
   - Component-specific data

2. Global State
   - User authentication state
   - Online presence
   - Theme preferences

## Real-time Features

Components integrate with Supabase's real-time functionality for:

1. Message Updates
```typescript
channel.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'messages'
  },
  (payload) => {
    handleUpdate()
  }
)
```

2. User Presence
```typescript
channel.on(
  'presence',
  { event: 'sync' },
  () => {
    updateOnlineUsers()
  }
)
```

3. Channel Membership Updates
```typescript
channel.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'channel_members'
  },
  () => {
    fetchChannels()
  }
)
```

4. New Conversations and Participants
```typescript
// New conversations
channel.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'conversations'
  },
  () => {
    fetchDirectMessages()
  }
)

// New conversation participants
channel.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'conversation_participants',
    filter: `user_id=eq.${userId}`
  },
  () => {
    fetchDirectMessages()
  }
)
```

## Error Handling

Components implement error handling for:
- Failed API calls
- File upload/download errors
- Real-time subscription failures
- Invalid user input

Each error is caught and displayed via the Notification component. 

### Channel Creation and Joining

#### Channel Creation
- Users can create new channels by providing a unique channel name.
- If a channel with the same name already exists, a toast notification will inform the user to choose a different name.
- The channel creator is automatically added as a member of the new channel.

#### Channel Joining
- Users can join existing channels by selecting them from the list of available channels.
- Upon joining, users are added to the channel's member list.

#### Relevant Database Tables
- **channels**: Stores channel information such as `id`, `name`, and `created_at`.
- **channel_members**: Manages the relationship between users and channels, tracking which users have joined which channels.

#### TypeScript Types
- `Channel`: Represents a channel entity with properties like `id` and `name`.
- `DirectMessage`: Represents a direct message conversation.

#### Error Handling
- Uses `react-hot-toast` to display error notifications, such as when a channel name is already taken. 