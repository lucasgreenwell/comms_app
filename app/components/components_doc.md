# Components Directory Documentation

## Overview
The components directory contains reusable UI components used throughout the application. These components are built with TypeScript and follow a consistent type system.

## Directory Structure
```
app/components/
├── MessageDisplay.tsx      # Message display component with emoji reactions and file attachments
├── Notification.tsx        # Toast notification component
├── SearchModal.tsx         # Global search modal component
├── Sidebar.tsx            # Main navigation sidebar component
├── TourPopup.tsx          # Tour guide popup component
└── UserDisplay.tsx        # User avatar and status display component
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