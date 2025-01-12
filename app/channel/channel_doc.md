# Channel Directory Documentation

## Overview
The channel directory contains components and functionality for handling channel-based communication in the Slack clone application. It implements real-time messaging, thread discussions, file attachments, and message translations.

## Directory Structure
```
app/channel/
├── [channelId]/
│   ├── page.tsx              # Main channel page component
│   ├── PostItem.tsx          # Individual post component
│   ├── ThreadComments.tsx    # Thread discussion component
│   └── ThreadCommentItem.tsx # Individual thread comment component
```

## User Interaction Flows

### Post Creation Flow
1. User enters message content and/or selects files
2. Frontend:
   - Creates temporary post with optimistic update
   - Clears input field and file selection
   - Displays temporary post in UI
3. Backend Process:
   - Uploads any attached files to Supabase storage
   - Creates file records in `files` table
   - Creates post record in `posts` table
   - Links files to post in `file_attachments` table
4. Real-time Updates:
   - Other users receive post via Supabase real-time subscription
   - Translation service processes the post
   - Users receive translation updates via subscription

### File Upload Flow
1. User selects files through the UI
2. Files are uploaded to Supabase storage
3. File records are created in the `files` table
4. File attachments are linked to posts/comments

### Post Emoji Reaction Flow
1. User clicks emoji reaction button
2. Frontend:
   - Opens emoji picker popover
   - Shows emoji grid with pagination
3. User selects emoji
4. Backend Process:
   - Creates record in `emoji_reactions` table with:
     - post_id
     - user_id
     - emoji
     - created_at
5. Real-time Updates:
   - Supabase subscription triggers update
   - UI updates to show new reaction count
   - Other users receive reaction update via subscription
6. Error Handling:
   - Shows toast notification on success/failure
   - Handles duplicate reactions (one per user per emoji)

### Post Edit Flow
1. User initiates edit mode
2. Frontend:
   - Displays editable text field with current content
   - Shows cancel and confirm buttons
   - Provides keyboard shortcuts (Enter to save, Escape to cancel)
3. User submits edit
4. Backend Process:
   - Updates post record in `posts` table
5. Real-time Updates:
   - Other users receive post update via subscription
6. Error Handling:
   - Shows toast notification on success/failure
   - Reverts to original content on error

### Post Delete Flow
1. User clicks delete button
2. Backend Process:
   - Deletes record from `posts` table
   - Database triggers handle cascading deletions:
     - File attachments
     - Reactions
     - Thread comments
     - Translations
3. Real-time Updates:
   - Other users receive deletion event via Supabase subscription
   - UI removes post and associated content
4. Error Handling:
   - Shows toast notification on success/failure

### Thread Comment Flows

#### Comment Creation
1. User opens thread view
2. User enters comment content and/or selects files
3. Frontend:
   - Shows file preview if files selected
   - Allows file removal before sending
4. Backend Process:
   - Uploads files to Supabase storage (if any)
   - Creates file records in `files` table
   - Creates record in `post_thread_comments` table
   - Creates file attachments in `file_attachments` table
   - Triggers translation service
5. Real-time Updates:
   - Other users in thread receive update via subscription
   - Parent post thread count updates automatically
6. Error Handling:
   - Shows toast notification on success/failure
   - Handles file upload errors individually

#### Comment Emoji Reaction
1. Same flow as post reactions
2. Uses same `emoji_reactions` table with `post_thread_comment_id` instead of `post_id`
3. Uses same real-time subscription system
4. Shows reactions in thread view immediately

#### Comment Edit
1. Same flow as post edit
2. Uses same UI components and keyboard shortcuts
3. Updates `post_thread_comments` table
4. Triggers translation service
5. Real-time updates to all thread viewers

#### Comment Delete
1. Same flow as post delete
2. Deletes from `post_thread_comments` table
3. Database triggers handle cascading deletions:
   - File attachments
   - Reactions
   - Translations
4. Updates thread count on parent post
5. Real-time updates to thread viewers
6. Shows toast notification on success/failure

## Components

### 1. Channel Page (`[channelId]/page.tsx`)

#### Purpose
Main component for displaying and managing a channel's messages and interactions.

#### Key Features
- Real-time messaging
- File attachments
- Message threading
- Channel member management
- Message translations
- Optimistic updates

#### Key Components and Functions

##### State Management
```typescript
interface Channel {
  id: string
  name: string
}

// Main state variables
const [posts, setPosts] = useState<Post[]>([])
const [channel, setChannel] = useState<Channel | null>(null)
const [activeThread, setActiveThread] = useState<{...} | null>(null)
const [selectedFiles, setSelectedFiles] = useState<File[]>([])
```

##### API Endpoints Used
- `POST /api/posts` - Create new post
- `GET /api/posts?channelId={channelId}` - Fetch channel posts

##### Key Functions
1. `handleSendMessage(e: React.FormEvent)`
   - Handles message submission
   - Manages file uploads
   - Implements optimistic updates

2. `setupRealtimeSubscription()`
   - Sets up real-time listeners for posts, files, and attachments
   - Manages Supabase channel subscriptions

3. `handleLeaveChannel()`
   - Manages user leaving the channel
   - Updates channel_members table

4. `handleThreadOpen(post: Post)`
   - Opens thread view for a post
   - Updates URL parameters

### 2. PostItem Component (`[channelId]/PostItem.tsx`)

#### Purpose
Displays individual posts within the channel with associated metadata and actions.

#### Key Features
- Message display
- Thread count
- Real-time translation updates
- Message editing

#### Key Functions
1. `setupTranslationSubscription()`
   - Manages real-time translation updates
   - Updates post content when translations change

2. `fetchThreadCount()`
   - Retrieves count of thread comments
   - Updates thread count display

### 3. ThreadComments Component (`[channelId]/ThreadComments.tsx`)

#### Purpose
Manages thread discussions for individual posts.

#### Key Features
- Thread comment display
- File attachments in threads
- Real-time updates
- Theme support

#### API Endpoints Used
- `GET /api/thread-comments?postId={postId}` - Fetch thread comments

#### Key Functions
1. `setupRealtimeSubscription()`
   - Manages real-time updates for comments
   - Handles file attachment changes
   - Updates thread state

### 4. ThreadCommentItem Component (`[channelId]/ThreadCommentItem.tsx`)

#### Purpose
Renders individual comments within a thread discussion, utilizing the shared MessageDisplay component.

#### Key Features
- Comment display with user information
- File attachment display
- Translation support
- Online user status integration

#### Component Interface
```typescript
interface ThreadCommentItemProps {
  comment: ThreadComment
  onCommentUpdate: () => void
}

interface ThreadComment {
  id: string
  user_id: string
  post_id: string
  content: string
  created_at: string
  user: {
    id: string
    email: string
    display_name?: string | null
    native_language?: string | null
  }
  files?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    path: string
  }[]
  translation?: {
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
  } | null
}
```

#### Integration
- Uses the shared `MessageDisplay` component for consistent message rendering
- Integrates with `useUser` hook for current user context
- Integrates with `usePresence` hook for online user status

## Database Schema

### Posts Table
```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ,
    content TEXT,
    user_id UUID REFERENCES users(id),
    channel_id UUID REFERENCES channels(id)
);
```

### Post Thread Comments Table
```sql
CREATE TABLE post_thread_comments (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES posts(id),
    user_id UUID REFERENCES users(id),
    content TEXT,
    created_at TIMESTAMPTZ
);
```

### File Attachments Table
```sql
CREATE TABLE file_attachments (
    id UUID PRIMARY KEY,
    file_id UUID REFERENCES files(id),
    post_id UUID REFERENCES posts(id),
    post_thread_comment_id UUID REFERENCES post_thread_comments(id),
    created_at TIMESTAMPTZ
);
```

### Files Table
```sql
CREATE TABLE files (
    id UUID PRIMARY KEY,
    file_name TEXT,
    file_type TEXT,
    file_size INT8,
    bucket TEXT,
    path TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ
);
```

### Emoji Reactions Table
```sql
CREATE TABLE emoji_reactions (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES posts(id),
    post_thread_comment_id UUID REFERENCES post_thread_comments(id),
    created_at TIMESTAMPTZ,
    user_id UUID REFERENCES users(id),
    emoji TEXT
);
```

### Translations Table
```sql
CREATE TABLE translations (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES posts(id),
    post_thread_comment_id UUID REFERENCES post_thread_comments(id),
    created_at TIMESTAMPTZ,
    mandarin_chinese_translation TEXT,
    spanish_translation TEXT,
    english_translation TEXT,
    hindi_translation TEXT,
    arabic_translation TEXT,
    bengali_translation TEXT,
    portuguese_translation TEXT,
    russian_translation TEXT,
    japanese_translation TEXT,
    western_punjabi_translation TEXT
);
```

### Channel Members Table
```sql
CREATE TABLE channel_members (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    channel_id UUID REFERENCES channels(id),
    created_at TIMESTAMPTZ
);
```

## Real-time Features

The application uses Supabase's real-time functionality for:
1. Message updates
2. File attachment changes
3. Translation updates
4. Thread comment synchronization

## Request/Response Formats

### Create Post Request
```typescript
POST /api/posts
{
  channelId: string
  userId: string
  content: string
  fileIds?: string[]
}
```

### Thread Comments Request
```typescript
GET /api/thread-comments?postId={postId}
Response: ThreadComment[]
```

## Error Handling

The application implements comprehensive error handling for:
- Failed message sends
- File upload errors
- Network issues
- Authentication errors

Each error is caught and displayed to the user via toast notifications. 